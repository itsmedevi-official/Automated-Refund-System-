import { createContext } from "react";

/** Kept in its own module so the provider file only exports a component. */
export const WalletContext = createContext(null);
