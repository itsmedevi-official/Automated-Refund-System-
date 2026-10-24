const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * The on-chain distance helper is validated against a high-precision haversine
 * implementation running in JavaScript. The contract uses the equirectangular
 * approximation, which is accurate to well under 1 % for the distances involved
 * in last-mile delivery verification.
 */
function toMicro(degrees) {
  return Math.round(degrees * 1e6);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

describe("GeoUtils (on-chain geolocation)", function () {
  let escrow;

  before(async function () {
    const [, escrowAgent] = await ethers.getSigners();
    const Escrow = await ethers.getContractFactory("SmartEscrow");
    escrow = await Escrow.deploy(escrowAgent.address);
    await escrow.waitForDeployment();
  });

  async function onChainDistance(a, b) {
    return Number(
      await escrow.previewDistance(toMicro(a[0]), toMicro(a[1]), toMicro(b[0]), toMicro(b[1]))
    );
  }

  it("returns exactly zero for identical coordinates", async function () {
    expect(await onChainDistance([12.9716, 77.5946], [12.9716, 77.5946])).to.equal(0);
  });

  it("matches the haversine reference for a 60 m delivery", async function () {
    const a = [12.9716, 77.5946];
    const b = [12.972, 77.595];
    const reference = haversineMeters(...a, ...b);
    const value = await onChainDistance(a, b);
    expect(reference).to.be.greaterThan(40);
    expect(value).to.be.closeTo(reference, Math.max(1, reference * 0.01));
  });

  it("matches the haversine reference for a city-scale distance", async function () {
    const a = [12.9716, 77.5946];
    const b = [12.98, 77.6];
    const reference = haversineMeters(...a, ...b);
    const value = await onChainDistance(a, b);
    expect(reference).to.be.greaterThan(900);
    expect(value).to.be.closeTo(reference, Math.max(2, reference * 0.01));
  });

  it("supports the southern and western hemispheres", async function () {
    const a = [-33.8688, 151.2093]; // Sydney
    const b = [-33.8692, 151.2098];
    const reference = haversineMeters(...a, ...b);
    const value = await onChainDistance(a, b);
    expect(value).to.be.closeTo(reference, Math.max(1, reference * 0.01));

    const c = [40.7128, -74.006]; // New York
    const d = [40.7132, -74.0066];
    const reference2 = haversineMeters(...c, ...d);
    const value2 = await onChainDistance(c, d);
    expect(value2).to.be.closeTo(reference2, Math.max(1, reference2 * 0.01));
  });

  it("normalises longitudes that cross the antimeridian", async function () {
    const value = await onChainDistance([0, 179.999], [0, -179.999]);
    expect(value).to.be.lessThan(1000);
    expect(value).to.be.greaterThan(0);
  });

  it("is symmetric", async function () {
    const a = [12.9716, 77.5946];
    const b = [13.05, 77.62];
    const forward = await onChainDistance(a, b);
    const backward = await onChainDistance(b, a);
    expect(Math.abs(forward - backward)).to.be.lessThan(2);
  });

  it("grows with distance", async function () {
    const base = [12.9716, 77.5946];
    const close = await onChainDistance(base, [12.972, 77.595]);
    const far = await onChainDistance(base, [12.99, 77.62]);
    expect(far).to.be.greaterThan(close * 10);
  });
});
