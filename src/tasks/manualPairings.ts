import { Pairing } from "../models/Pairing";

/* eslint-disable @typescript-eslint/camelcase */
export const addManualPairings = async () => {
    const newPairing = {
        dst_address: "secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek",
        dst_coin: "sSCRT",
        dst_network: "secret",
        src_address: "0x2b89bf8ba858cd2fcee1fada378d5cd6936968be",
        src_coin: "wSCRT",
        src_network: "ethereum",
        name: "Secret",
        symbol: "sSCRT",
        decimals: 6,
        price: "0",
        totalLocked: "0",
        totalLockedNormal: "0",
        totalLockedUSD: "0",
        display_props: { 
            symbol: "sSCRT",
            label: "sSCRT",
            hidden: false
        },
    };

    await Pairing.findOneAndUpdate(
        {
            dst_address: "secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek"
        },
        newPairing,
        {
            upsert: true
        }
    );
};
