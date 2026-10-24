// import React, { useState } from "react";
// import { ethers } from "ethers";

// export default function Signup() {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [wallet, setWallet] = useState(null);

//   const handleSignup = async () => {
//     const wallet = ethers.Wallet.createRandom();
//     const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
//     const signer = provider.getSigner(0);
//     const tx = await signer.sendTransaction({
//       to: wallet.address,
//       value: ethers.parseEther("1") // Send 1 ETH
//     });
//     await tx.wait();

//     setWallet(wallet);
//     alert(`Account Created!\nAddress: ${wallet.address}\nPrivate Key: ${wallet.privateKey}`);
//   };

//   return (
//     <div>
//       <h2>Signup</h2>
//       <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
//       <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
//       <button onClick={handleSignup}>Sign Up</button>
//       {wallet && <p>Import your private key in MetaMask: {wallet.privateKey}</p>}
//     </div>
//   );
// }
