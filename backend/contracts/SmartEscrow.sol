// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GeoUtils} from "./libraries/GeoUtils.sol";

/**
 * @title SmartEscrow
 * @notice Decentralised escrow with OTP + geolocation based delivery verification and
 *         automatic dispute resolution, as described in Chapter 3 of the thesis.
 *
 * Lifecycle of a deal:
 *   FUNDED -> OTP_GENERATED -> DELIVERED -> COMPLETED | REFUNDED
 *                                   \-> DISPUTED -> COMPLETED | REFUNDED | ESCALATED -> COMPLETED | REFUNDED
 *
 * The contract holds the buyer's ETH. Funds only leave the contract through one of
 * the terminal paths below, and every path is guarded so a deal can settle once:
 *   1. releaseFunds()        no dispute within the dispute window (permissionless, Alg. 3)
 *   2. autoResolveDispute()  buyer dispute resolved with the geolocation rule (Alg. 4)
 *   3. resolveDispute()      escrow agent decides when the automatic rule cannot
 */
contract SmartEscrow {
    enum DealState {
        NONE,
        FUNDED,
        OTP_GENERATED,
        DELIVERED,
        DISPUTED,
        ESCALATED,
        COMPLETED,
        REFUNDED
    }

    struct Deal {
        uint256 id;
        address buyer;
        address seller;
        address deliveryAgent;
        uint256 amount;
        DealState state;
        uint256 createdAt;
        uint256 otpGeneratedAt;
        uint256 deliveredAt;
        uint256 disputeDeadline;
        uint256 disputedAt;
        uint256 resolvedAt;
        bytes32 otpHash;
        bool otpVerified;
        bool disputeRaised;
        string disputeReason;
        string resolutionNote;
        int256 buyerLat;
        int256 buyerLon;
        uint256 buyerLocationAt;
        int256 agentLat;
        int256 agentLon;
        uint256 distanceMeters;
        address resolvedBy;
    }

    /// @notice Platform owner: tunes the contract parameters.
    address public owner;
    /// @notice Escrow agent (arbitrator) that handles escalated disputes.
    address public escrowAgent;
    /// @notice Maximum allowed distance (metres) between buyer and agent at delivery.
    uint256 public distanceThresholdMeters;
    /// @notice Time window (seconds) after a verified delivery during which a dispute may be raised.
    uint256 public disputeWindowSeconds;
    /// @notice Number of deals created so far (deal ids start at 1).
    uint256 public dealCount;

    mapping(uint256 => Deal) private _deals;
    mapping(address => uint256[]) private _buyerDeals;
    mapping(address => uint256[]) private _sellerDeals;
    mapping(address => uint256[]) private _agentDeals;
    uint256[] private _escalatedDeals;

    bool private _entered;

    event DealCreated(
        uint256 indexed dealId,
        address indexed buyer,
        address indexed seller,
        address deliveryAgent,
        uint256 amount,
        uint256 createdAt
    );
    event FundsDeposited(uint256 indexed dealId, address indexed buyer, uint256 amount);
    event BuyerLocationSet(uint256 indexed dealId, int256 lat, int256 lon, uint256 at);
    event DeliveryAgentUpdated(uint256 indexed dealId, address indexed deliveryAgent);
    /// @dev The OTP is published so the buyer's wallet can display it. It is also
    ///      stored as a hash on-chain (see Deal.otpHash) so only the hash is used for checks.
    event OTPGenerated(uint256 indexed dealId, uint256 otp, address indexed buyer, uint256 at);
    event OTPVerified(
        uint256 indexed dealId,
        address indexed deliveryAgent,
        int256 lat,
        int256 lon,
        uint256 at
    );
    event DisputeRaised(uint256 indexed dealId, address indexed buyer, string reason, uint256 at);
    event DisputeEscalated(uint256 indexed dealId, string reason, uint256 at);
    event DisputeResolved(
        uint256 indexed dealId,
        bool refundToBuyer,
        address indexed resolver,
        uint256 distanceMeters,
        string note
    );
    event FundsReleased(
        uint256 indexed dealId,
        address indexed seller,
        uint256 amount,
        uint256 distanceMeters,
        address indexed by
    );
    event BuyerRefunded(
        uint256 indexed dealId,
        address indexed buyer,
        uint256 amount,
        uint256 distanceMeters,
        address indexed by
    );
    event DistanceThresholdUpdated(uint256 distanceThresholdMeters);
    event DisputeWindowUpdated(uint256 disputeWindowSeconds);
    event EscrowAgentUpdated(address indexed escrowAgent);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier nonReentrant() {
        require(!_entered, "Reentrant call");
        _entered = true;
        _;
        _entered = false;
    }

    constructor(address _escrowAgent) {
        require(_escrowAgent != address(0), "Escrow agent cannot be zero address");
        owner = msg.sender;
        escrowAgent = _escrowAgent;
        distanceThresholdMeters = 200; // metres (thesis: predefined threshold)
        disputeWindowSeconds = 60; // seconds, demo friendly; owner adjustable
    }

    // ---------------------------------------------------------------------
    // Buyer actions
    // ---------------------------------------------------------------------

    /**
     * @notice Creates a funded escrow deal and locks msg.value inside the contract.
     * @dev Thesis Alg. 1 "deposit funds": amount must be positive, parties must be
     *      valid and distinct. The buyer is the caller, so roles cannot be spoofed.
     */
    function createDeal(address seller, address deliveryAgent)
        external
        payable
        returns (uint256 dealId)
    {
        require(msg.value > 0, "Deposit amount must be greater than zero");
        require(seller != address(0), "Seller cannot be zero address");
        require(deliveryAgent != address(0), "Delivery agent cannot be zero address");
        require(seller != msg.sender, "Buyer and seller must be different");
        require(deliveryAgent != msg.sender, "Buyer cannot be the delivery agent");
        require(seller != deliveryAgent, "Seller cannot be the delivery agent");

        dealId = ++dealCount;
        Deal storage deal = _deals[dealId];
        deal.id = dealId;
        deal.buyer = msg.sender;
        deal.seller = seller;
        deal.deliveryAgent = deliveryAgent;
        deal.amount = msg.value;
        deal.state = DealState.FUNDED;
        deal.createdAt = block.timestamp;
        deal.disputeDeadline = type(uint256).max;

        _buyerDeals[msg.sender].push(dealId);
        _sellerDeals[seller].push(dealId);
        _agentDeals[deliveryAgent].push(dealId);

        emit DealCreated(dealId, msg.sender, seller, deliveryAgent, msg.value, block.timestamp);
        emit FundsDeposited(dealId, msg.sender, msg.value);
    }

    /**
     * @notice Stores the buyer's delivery location (micro-degrees).
     * @dev Captured by the buyer UI before the delivery is verified; used by the
     *      automatic dispute resolution to compute the delivery distance.
     */
    function setBuyerLocation(uint256 dealId, int256 lat, int256 lon) external {
        Deal storage deal = _requireDeal(dealId);
        require(msg.sender == deal.buyer, "Only buyer can set buyer location");
        require(_isOpen(deal.state), "Deal is already settled");
        _validateCoordinates(lat, lon);

        deal.buyerLat = lat;
        deal.buyerLon = lon;
        deal.buyerLocationAt = block.timestamp;

        // Keep the stored distance in sync if the buyer updates their position after delivery.
        if (deal.otpVerified) {
            deal.distanceMeters = GeoUtils.distanceMeters(
                lat,
                lon,
                deal.agentLat,
                deal.agentLon
            );
        }

        emit BuyerLocationSet(dealId, lat, lon, block.timestamp);
    }

    /**
     * @notice Replaces the delivery agent before the OTP is generated.
     */
    function updateDeliveryAgent(uint256 dealId, address newAgent) external {
        Deal storage deal = _requireDeal(dealId);
        require(msg.sender == deal.buyer, "Only buyer can change the delivery agent");
        require(
            deal.state == DealState.FUNDED,
            "Delivery agent can only change before OTP generation"
        );
        require(newAgent != address(0), "Delivery agent cannot be zero address");
        require(newAgent != deal.buyer && newAgent != deal.seller, "Invalid delivery agent");

        _agentDeals[newAgent].push(dealId);
        deal.deliveryAgent = newAgent;

        emit DeliveryAgentUpdated(dealId, newAgent);
    }

    // ---------------------------------------------------------------------
    // Delivery agent actions
    // ---------------------------------------------------------------------

    /**
     * @notice Generates a 4-digit OTP bound to this deal (thesis Alg. 3).
     * @dev OTP = keccak256(timestamp, dealId, buyer, agent, prevrandao) % 9000 + 1000.
     *      Only the hash is stored; the OTP itself is emitted so the buyer wallet can
     *      reveal it, while the delivery-agent UI never displays it.
     */
    function generateOTP(uint256 dealId) external {
        Deal storage deal = _requireDeal(dealId);
        require(
            msg.sender == deal.deliveryAgent,
            "Only the assigned delivery agent can generate the OTP"
        );
        require(deal.state == DealState.FUNDED, "OTP can only be generated for a funded deal");

        uint256 otp = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    dealId,
                    deal.buyer,
                    deal.deliveryAgent,
                    block.prevrandao
                )
            )
        ) % 9000 + 1000;

        deal.otpHash = keccak256(abi.encodePacked(otp));
        deal.otpGeneratedAt = block.timestamp;
        deal.state = DealState.OTP_GENERATED;

        emit OTPGenerated(dealId, otp, deal.buyer, block.timestamp);
    }

    /**
     * @notice Verifies the OTP and records the delivery agent's location.
     * @dev Thesis Alg. 3: V_OTP <- True, the delivery timestamp is stored and the
     *      dispute window starts. An incorrect OTP reverts the whole call.
     */
    function verifyOTP(uint256 dealId, uint256 otp, int256 agentLat, int256 agentLon) external {
        Deal storage deal = _requireDeal(dealId);
        require(
            msg.sender == deal.deliveryAgent,
            "Only the assigned delivery agent can verify the OTP"
        );
        require(deal.state == DealState.OTP_GENERATED, "OTP has not been generated for this deal");
        require(keccak256(abi.encodePacked(otp)) == deal.otpHash, "Invalid OTP");
        _validateCoordinates(agentLat, agentLon);

        deal.otpVerified = true;
        deal.agentLat = agentLat;
        deal.agentLon = agentLon;
        deal.deliveredAt = block.timestamp;
        deal.disputeDeadline = block.timestamp + disputeWindowSeconds;
        deal.state = DealState.DELIVERED;

        // Recorded for the UI; recomputed at dispute time in case the buyer moved.
        if (deal.buyerLocationAt != 0) {
            deal.distanceMeters = GeoUtils.distanceMeters(
                deal.buyerLat,
                deal.buyerLon,
                agentLat,
                agentLon
            );
        }

        emit OTPVerified(dealId, msg.sender, agentLat, agentLon, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Dispute handling
    // ---------------------------------------------------------------------

    /**
     * @notice Buyer raises a dispute (non-delivery, wrong item, damaged item, ...).
     */
    function raiseDispute(uint256 dealId, string calldata reason) external {
        Deal storage deal = _requireDeal(dealId);
        require(msg.sender == deal.buyer, "Only the buyer can raise a dispute");
        require(_isOpen(deal.state), "Deal is already settled");
        require(!deal.disputeRaised, "Dispute already raised");
        require(bytes(reason).length > 0, "Dispute reason is required");

        deal.disputeRaised = true;
        deal.disputeReason = reason;
        deal.disputedAt = block.timestamp;
        deal.state = DealState.DISPUTED;

        emit DisputeRaised(dealId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Moves an unresolved dispute to manual review.
     */
    function escalateDispute(uint256 dealId) external {
        Deal storage deal = _requireDeal(dealId);
        require(
            msg.sender == deal.buyer ||
                msg.sender == deal.seller ||
                msg.sender == deal.deliveryAgent ||
                msg.sender == escrowAgent,
            "Not allowed to escalate this dispute"
        );
        require(deal.state == DealState.DISPUTED, "No dispute to escalate");

        _escalate(deal, "Escalated for manual review by the escrow agent");
    }

    // ---------------------------------------------------------------------
    // Resolution paths
    // ---------------------------------------------------------------------

    /**
     * @notice Automatic dispute resolution (thesis Alg. 4).
     * @dev Compares the buyer and delivery-agent locations:
     *        distance <= threshold  -> delivery verified -> pay the seller
     *        distance >  threshold  -> delivery failed   -> refund the buyer
     *      If the OTP was never verified or the buyer location is unknown the case is
     *      escalated to the escrow agent instead of guessing.
     *      Callable by anyone (buyer, seller, delivery agent, keeper, escrow agent).
     */
    function autoResolveDispute(uint256 dealId) external nonReentrant {
        Deal storage deal = _requireDeal(dealId);
        require(deal.state == DealState.DISPUTED, "No active dispute for this deal");

        if (!deal.otpVerified || deal.buyerLocationAt == 0) {
            _escalate(deal, "Delivery evidence incomplete: manual review required");
            return;
        }

        deal.distanceMeters = GeoUtils.distanceMeters(
            deal.buyerLat,
            deal.buyerLon,
            deal.agentLat,
            deal.agentLon
        );

        if (deal.distanceMeters <= distanceThresholdMeters) {
            _settle(
                deal,
                false,
                msg.sender,
                "Automatic resolution: delivery took place within the distance threshold",
                true
            );
        } else {
            _settle(
                deal,
                true,
                msg.sender,
                "Automatic resolution: delivery location outside the distance threshold",
                true
            );
        }
    }

    /**
     * @notice Releases the escrowed funds to the seller once the dispute window expired.
     * @dev Thesis Alg. 3 release condition: funds deposited, no dispute raised and
     *      T >= TD + delta_t. Permissionless on purpose, so no backend is required for
     *      the funds to be released; the keeper script simply calls this for convenience.
     */
    function releaseFunds(uint256 dealId) external nonReentrant {
        Deal storage deal = _requireDeal(dealId);
        require(deal.state == DealState.DELIVERED, "Delivery is not verified");
        require(!deal.disputeRaised, "Dispute raised: wait for the resolution");
        require(block.timestamp >= deal.disputeDeadline, "Dispute window has not expired yet");

        _settle(deal, false, msg.sender, "Automatic release: no dispute within the window", false);
    }

    /**
     * @notice Escrow agent decides an escalated (or still disputed) case.
     * @param refundBuyer true to refund the buyer, false to pay the seller.
     */
    function resolveDispute(uint256 dealId, bool refundBuyer, string calldata note)
        external
        nonReentrant
    {
        Deal storage deal = _requireDeal(dealId);
        require(msg.sender == escrowAgent, "Only the escrow agent can resolve a dispute");
        require(
            deal.state == DealState.DISPUTED || deal.state == DealState.ESCALATED,
            "No active dispute for this deal"
        );

        if (deal.otpVerified && deal.buyerLocationAt != 0) {
            deal.distanceMeters = GeoUtils.distanceMeters(
                deal.buyerLat,
                deal.buyerLon,
                deal.agentLat,
                deal.agentLon
            );
        }

        _settle(deal, refundBuyer, msg.sender, note, true);
    }

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    function setDistanceThreshold(uint256 thresholdMeters) external onlyOwner {
        require(thresholdMeters > 0, "Threshold must be greater than zero");
        distanceThresholdMeters = thresholdMeters;
        emit DistanceThresholdUpdated(thresholdMeters);
    }

    function setDisputeWindow(uint256 windowSeconds) external onlyOwner {
        require(windowSeconds > 0, "Dispute window must be greater than zero");
        disputeWindowSeconds = windowSeconds;
        emit DisputeWindowUpdated(windowSeconds);
    }

    function setEscrowAgent(address newAgent) external onlyOwner {
        require(newAgent != address(0), "Escrow agent cannot be zero address");
        escrowAgent = newAgent;
        emit EscrowAgentUpdated(newAgent);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Full deal record (used by every dashboard).
    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _requireDeal(dealId);
    }

    function getDealsByBuyer(address account) external view returns (uint256[] memory) {
        return _buyerDeals[account];
    }

    function getDealsBySeller(address account) external view returns (uint256[] memory) {
        return _sellerDeals[account];
    }

    function getDealsByDeliveryAgent(address account) external view returns (uint256[] memory) {
        return _agentDeals[account];
    }

    function getEscalatedDealIds() external view returns (uint256[] memory) {
        return _escalatedDeals;
    }

    /// @notice Contract parameters exposed to the UI in one call.
    function getEscrowConfig()
        external
        view
        returns (
            address ownerAddress,
            address escrowAgentAddress,
            uint256 distanceThreshold,
            uint256 disputeWindow,
            uint256 totalDeals
        )
    {
        return (owner, escrowAgent, distanceThresholdMeters, disputeWindowSeconds, dealCount);
    }

    /// @notice Off-chain helper (also unit-tested) to preview a distance before submitting.
    function previewDistance(int256 lat1, int256 lon1, int256 lat2, int256 lon2)
        external
        pure
        returns (uint256)
    {
        return GeoUtils.distanceMeters(lat1, lon1, lat2, lon2);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    function _requireDeal(uint256 dealId) private view returns (Deal storage deal) {
        require(dealId > 0 && dealId <= dealCount, "Deal does not exist");
        return _deals[dealId];
    }

    function _isOpen(DealState state) private pure returns (bool) {
        return state == DealState.FUNDED ||
            state == DealState.OTP_GENERATED ||
            state == DealState.DELIVERED ||
            state == DealState.DISPUTED ||
            state == DealState.ESCALATED;
    }

    function _validateCoordinates(int256 lat, int256 lon) private pure {
        require(lat >= -90 * 1e6 && lat <= 90 * 1e6, "Latitude out of range");
        require(lon >= -180 * 1e6 && lon <= 180 * 1e6, "Longitude out of range");
    }

    function _escalate(Deal storage deal, string memory reason) private {
        deal.state = DealState.ESCALATED;
        _escalatedDeals.push(deal.id);
        emit DisputeEscalated(deal.id, reason, block.timestamp);
    }

    /// @dev Swap-and-pop so the escrow-agent queue only lists deals that are still open.
    function _removeEscalated(uint256 dealId) private {
        uint256 length = _escalatedDeals.length;
        for (uint256 i = 0; i < length; i++) {
            if (_escalatedDeals[i] == dealId) {
                _escalatedDeals[i] = _escalatedDeals[length - 1];
                _escalatedDeals.pop();
                break;
            }
        }
    }

    /**
     * @dev Single settlement path: zeroes the balance before transferring, marks the
     *      terminal state, then pays exactly one party. Prevents double settlement and
     *      re-entrancy (combined with the nonReentrant guard on callers).
     */
    function _settle(
        Deal storage deal,
        bool refundBuyer,
        address resolver,
        string memory note,
        bool wasDisputed
    ) private {
        uint256 payout = deal.amount;
        require(payout > 0, "Deal is already settled");

        // Remove the case from the escrow-agent queue before paying out.
        if (deal.state == DealState.ESCALATED) {
            _removeEscalated(deal.id);
        }

        deal.amount = 0;
        deal.resolvedAt = block.timestamp;
        deal.resolvedBy = resolver;
        deal.resolutionNote = note;

        if (refundBuyer) {
            deal.state = DealState.REFUNDED;
            (bool refunded, ) = payable(deal.buyer).call{value: payout}("");
            require(refunded, "Refund to buyer failed");
            emit BuyerRefunded(deal.id, deal.buyer, payout, deal.distanceMeters, resolver);
        } else {
            deal.state = DealState.COMPLETED;
            (bool paid, ) = payable(deal.seller).call{value: payout}("");
            require(paid, "Payment to seller failed");
            emit FundsReleased(deal.id, deal.seller, payout, deal.distanceMeters, resolver);
        }

        if (wasDisputed) {
            emit DisputeResolved(deal.id, refundBuyer, resolver, deal.distanceMeters, note);
        }
    }
}
