// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public buyer;
    address public seller;
    address public admin;
    address public deliveryAgent;
    uint256 public amount;
    uint256 public depositTimeStamp;
    bool public fundsDeposited;
    bool public disputeRaised;
    string public disputeReason;
    uint256 private otp;
    bool public otpVerified;

    address[] public selectedStakeholders; // Stores the selected stakeholders
    mapping(address => bool) public hasVoted;
    mapping(address => bool) public isStakeholder;
    uint256 public votesForBuyer;
    uint256 public votesForSeller;
    uint256 public votingDeadline;
    bool public votingActive;

    event FundsDeposited(address indexed buyer, address indexed seller, uint256 amount);
    event FundsReleased(address indexed seller, uint256 amount);
    event BuyerRefunded(address indexed buyer, uint256 amount);
    event DisputeRaised(address indexed buyer, string reason);
    event DisputeResolved(bool refundToBuyer, uint256 amount);
    event OTPGenerated(uint256 otp);
    event OTPVerified(address indexed buyer);
    event DAOStakeholdersSelected(address[] stakeholders);
    event VoteSubmitted(address voter, bool refundBuyer);
    event FinalVoteCount(uint256 votesForBuyer, uint256 votesForSeller);

    constructor(address _buyer, address _seller, address _admin, address _deliveryAgent) {
        buyer = _buyer;
        seller = _seller;
        admin = _admin;
        deliveryAgent = _deliveryAgent;
        
        fundsDeposited = false;
        disputeRaised = false;
        otpVerified = false;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Only buyer can perform this action");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyDeliveryAgent() {
        require(msg.sender == deliveryAgent, "Only delivery agent can perform this action");
        _;
    }

    modifier onlyStakeholder() {
        require(isStakeholder[msg.sender], "Not a stakeholder");
        _;
    }

    // Function to deposit funds (no changes here)
    function depositFunds(address _seller) external payable onlyBuyer {
        require(!fundsDeposited, "Funds already deposited");
        require(msg.value > 0, "Deposit amount must be greater than zero");
        require(_seller != address(0), "Seller cannot be zero address");

        seller = _seller; // Set the seller address passed in the function
        amount = msg.value; // Set the deposit amount
        fundsDeposited = true;
        depositTimeStamp = block.timestamp;

        emit FundsDeposited(buyer, seller, msg.value); // Emit the event with buyer, seller, and the amount
    }

    // Function to generate OTP (no changes here)
    function generateOTP() external onlyDeliveryAgent {
        require(fundsDeposited, "Funds not deposited yet");
        otp = (uint256(keccak256(abi.encodePacked(block.timestamp, buyer, deliveryAgent))) % 9000) + 1000;
        otpVerified = false;
        emit OTPGenerated(otp);
    }

    // Function to verify OTP (no changes here)
    function verifyOTP(uint256 _otp) external onlyDeliveryAgent {
        require(fundsDeposited, "Funds not deposited yet");
        require(otp == _otp, "Invalid OTP");

        otpVerified = true;
        emit OTPVerified(buyer);
    }

    // Function to get OTP (no changes here)
    function getOTP() external view returns (uint256) {
        require(msg.sender == buyer, "Only the buyer can view the OTP");
        return otp;
    }

    // Function to release funds (no changes here)
    function releaseFunds() external {
        require(fundsDeposited, "No funds deposited");
        require(!disputeRaised, "Dispute raised, wait for resolution");
        require(block.timestamp >= depositTimeStamp + 60, "Funds can only be released after 1 day of deposit");

        payable(seller).transfer(amount);
        emit FundsReleased(seller, amount);

        amount = 0;
        fundsDeposited = false;
        otpVerified = false;
    }

    // Function to raise dispute (no changes here)
    function raiseDispute(string memory reason) external onlyBuyer {
        require(fundsDeposited, "No funds deposited");
        require(!disputeRaised, "Dispute already raised");

        disputeReason = reason;
        disputeRaised = true;

        emit DisputeRaised(buyer, reason);
    }

    // Modify this function to set predefined stakeholder addresses
    function escalateToDAO(address[3] memory _stakeholders) external onlyAdmin {
        require(disputeRaised, "No dispute raised");
        require(!votingActive, "Voting already active");

        // Set the predefined stakeholder addresses
        delete selectedStakeholders; // Clear previous stakeholders

        // Add the 3 predefined stakeholders
        for (uint i = 0; i < 3; i++) {
            address candidate = _stakeholders[i];
            selectedStakeholders.push(candidate);
            isStakeholder[candidate] = true;
        }

        votingDeadline = block.timestamp + 1 days;
        votingActive = true;

        emit DAOStakeholdersSelected(selectedStakeholders);
    }

    // Function for stakeholders to vote on the dispute (no changes here)
    function voteOnDispute(bool refundBuyer) external onlyStakeholder {
        require(votingActive, "Voting is not active");
        require(block.timestamp < votingDeadline, "Voting period is over");
        require(!hasVoted[msg.sender], "Already voted");

        hasVoted[msg.sender] = true;
        if (refundBuyer) {
            votesForBuyer++;
        } else {
            votesForSeller++;
        }

        emit VoteSubmitted(msg.sender, refundBuyer);
    }

    // Finalize the vote and transfer funds (no changes here)
    function finalizeVoting() external onlyAdmin {
        require(votingActive, "Voting not active");
        require(block.timestamp >= votingDeadline, "Voting period not ended yet");

        votingActive = false;
        disputeRaised = false;
        disputeReason = "";

        for (uint i = 0; i < selectedStakeholders.length; i++) {
            isStakeholder[selectedStakeholders[i]] = false;
            hasVoted[selectedStakeholders[i]] = false;
        }

        emit FinalVoteCount(votesForBuyer, votesForSeller);

        if (votesForBuyer > votesForSeller) {
            payable(buyer).transfer(amount);
            emit BuyerRefunded(buyer, amount);
        } else {
            payable(seller).transfer(amount);
            emit FundsReleased(seller, amount);
        }

        amount = 0;
        fundsDeposited = false;
    }
}
