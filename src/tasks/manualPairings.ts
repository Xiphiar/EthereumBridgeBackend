import { Pairing } from "../models/Pairing";

/* eslint-disable @typescript-eslint/camelcase */
export const addManualPairings = async () => {
    const scrtPairing = {
        src_network: "ethereum",
        src_coin: "wSCRT",
        src_address: "0x2b89bf8ba858cd2fcee1fada378d5cd6936968be",
        dst_network: "secret",
        dst_coin: "sSCRT",
        dst_address: "secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek",
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
            hidden: false,
            usage: ["LPSTAKING", "REWARDS", "SWAP"],
        },
    };

    const sefiPairing = {
        src_network: "ethereum",
        src_coin: "SEFI",
        src_address: "0x773258b03c730f84af10dfcb1bfaa7487558b8ac",
        dst_network: "secret",
        dst_coin: "SEFI",
        dst_address: "secret15l9cqgz5uezgydrglaak5ahfac69kmx2qpd6xt",
        name: "Secret Finance",
        symbol: "SEFI",
        decimals: 6,
        price: "0",
        totalLocked: "0",
        totalLockedNormal: "0",
        totalLockedUSD: "0",
        display_props: { 
            symbol: "SEFI",
            label: "SEFI",
            hidden: false,
            usage: ["LPSTAKING", "REWARDS", "SWAP"],
        },
    };

    for (const pairing of [scrtPairing, sefiPairing]) {
        await Pairing.findOneAndUpdate(
            {
                dst_address: pairing.dst_address,
            },
            pairing,
            {
                upsert: true,
            }
        );
    }
};
