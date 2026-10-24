import { ethers } from "ethers";
import EscrowABI from "../../../backend/artifacts/contracts/Escrow.sol/Escrow.json";

const getContract = (contractAddress) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = provider.getSigner();
    return new ethers.Contract(contractAddress, EscrowABI.abi, signer);
};

export default getContract;