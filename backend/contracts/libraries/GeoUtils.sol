// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title GeoUtils
 * @notice Fixed-point geodesic helpers used by SmartEscrow to verify that the
 *         delivery agent was physically close to the buyer when the OTP was verified.
 * @dev Coordinates are micro-degrees (degrees * 1e6, e.g. 12.9716 -> 12971600) so that
 *      they can be stored as signed integers and still keep ~11 cm resolution.
 *
 *      Distances use the equirectangular approximation:
 *          d = R * sqrt(dLat^2 + (cos(meanLat) * dLon)^2)
 *      For the city-scale distances involved in last-mile delivery verification the
 *      error is far below one metre, while staying cheap enough to run on-chain.
 */
library GeoUtils {
    /// @notice Degrees -> micro-degrees scale factor.
    int256 internal constant MICRO = 1e6;
    /// @notice pi / 180 scaled by 1e18.
    int256 internal constant DEG_TO_RAD_1E18 = 17453292519943295;
    /// @notice pi scaled by 1e18.
    int256 internal constant PI_1E18 = 3141592653589793238;
    /// @notice 2 * pi scaled by 1e18.
    int256 internal constant TWO_PI_1E18 = 6283185307179586476;
    /// @notice Mean Earth radius in metres.
    uint256 internal constant EARTH_RADIUS_M = 6371000;
    int256 internal constant ONE_1E18 = 1e18;

    /// @notice Absolute value of a signed integer as an unsigned integer.
    function abs(int256 value) internal pure returns (uint256) {
        unchecked {
            return uint256(value >= 0 ? value : -value);
        }
    }

    /// @notice Converts micro-degrees into radians scaled by 1e18.
    function toRadians(int256 microDegrees) internal pure returns (int256) {
        return (microDegrees * DEG_TO_RAD_1E18) / MICRO;
    }

    /**
     * @notice Cosine of an angle expressed in radians scaled by 1e18.
     * @dev Taylor expansion to the x^14 term. The supported range is |x| <= pi/2,
     *      which covers every possible latitude after conversion.
     */
    function cos(int256 radians) internal pure returns (int256) {
        int256 x = radians >= 0 ? radians : -radians;
        if (x > PI_1E18 / 2) {
            return 0;
        }
        int256 x2 = (x * x) / ONE_1E18;
        int256 sum = ONE_1E18;
        int256 term = ONE_1E18;
        unchecked {
            for (int256 k = 1; k <= 7; k++) {
                term = -(term * x2) / (ONE_1E18 * (2 * k - 1) * (2 * k));
                sum += term;
            }
        }
        return sum < int256(0) ? int256(0) : sum;
    }

    /// @notice Babylonian square root.
    function sqrt(uint256 value) internal pure returns (uint256 result) {
        if (value == 0) {
            return 0;
        }
        result = value;
        uint256 y = (value + 1) / 2;
        while (y < result) {
            result = y;
            y = (value / y + y) / 2;
        }
    }

    /**
     * @notice Great-circle distance in metres between two micro-degree coordinates.
     * @return distance in metres (rounded down).
     */
    function distanceMeters(int256 lat1, int256 lon1, int256 lat2, int256 lon2)
        internal
        pure
        returns (uint256)
    {
        int256 lat1r = toRadians(lat1);
        int256 lat2r = toRadians(lat2);
        int256 lon1r = toRadians(lon1);
        int256 lon2r = toRadians(lon2);

        int256 dLat = lat2r - lat1r;
        int256 dLon = lon2r - lon1r;
        if (dLon > PI_1E18) {
            dLon -= TWO_PI_1E18;
        } else if (dLon < -PI_1E18) {
            dLon += TWO_PI_1E18;
        }

        int256 meanLat = (lat1r + lat2r) / 2;
        int256 cosMean = cos(meanLat);
        int256 lonComponentScaled = (dLon * cosMean) / ONE_1E18;

        uint256 latComponent = abs(dLat);
        uint256 lonComponent = abs(lonComponentScaled);
        uint256 centralAngle = sqrt(latComponent * latComponent + lonComponent * lonComponent);
        return (centralAngle * EARTH_RADIUS_M) / uint256(ONE_1E18);
    }
}
