import { CosmWasmClient } from "secretjs";
import config from "../util/config";
import { Rewards } from "../models/Rewards";
import axios from "axios";
import { Tokens } from "../models/Tokens";

type RewardTokenResponse = {
    reward_token: {
        token: {
            address: string;
            contract_hash: string;
        };
    };
}

type IncentivizedTokenResponse = {
    incentivized_token: {
        token: {
            address: string;
            contract_hash: string;
        };
    };
}

/* eslint-disable @typescript-eslint/camelcase */
export const updateV2RewardsPools = async () => {
    console.log("Updating V2 Rewards Pools");

    const queryClient = new CosmWasmClient(config.secretNodeUrl);

    const contracts = await queryClient.getContracts(104);
    const codeHash = await queryClient.getCodeHashByCodeId(104);
    console.log(`Found ${contracts.length} V2 rewards pools on-chain`);
    const noAddress = contracts.filter(c => !c.address);
    console.log(`${noAddress.length} V2 rewards pools do not have an address`);

    for (const contract of contracts) {
        let contract_address = contract.address;

        // contract.address is undefined for some reason, get the address by label
        if (!contract_address) {
            console.log("Missing contract address, fetching...");
            const { data } = await axios.get(`${config.secretNodeUrl}/compute/v1beta1/contract_address/${contract.label}`);
            console.log(data);
            contract_address = data.contract_address;
        }

        if (contract_address === "secret18pqz6x67ty6wnjlrcultfcdc5trz2xy5tjglcx") {
            console.log("Skipping ALTER pool");
            continue;
        }

        const existingDocument = await Rewards.findOne({ pool_address: contract_address }).lean();
        if (existingDocument) {
            await Rewards.findOneAndUpdate({
                pool_address: contract_address
            }, {
                deprecated: true,
                deprecated_by: "f",
            });
            console.log("Skipping V2 pool", contract.label, contract_address);
            continue;
        }
        
        console.log("Updating V2 pool", contract.label, contract_address);

        const itr: IncentivizedTokenResponse = await queryClient.queryContractSmart(contract_address, { incentivized_token: {} });
        const incentivizedTokenAddress = itr.incentivized_token.token.address;
        if (!incentivizedTokenAddress) {
            console.error(`Unable to find iToken address ${incentivizedTokenAddress} for v2 pool ${contract.label}`);
            continue;
        }
        const iToken = await Tokens.findOne({address: incentivizedTokenAddress}).lean();
        if (!iToken) {
            console.error(`Unable to find iToken for v2 pool ${contract.label}`);
            continue;
        }

        const { reward_token: { token: { address: rewardTokenAddress }}}: RewardTokenResponse = await queryClient.queryContractSmart(contract_address, { reward_token: {} });
        const rToken = await Tokens.findOne({address: rewardTokenAddress}).lean();

        const newRewardsDocument = {
            "pool_address": contract_address,
            "contract_hash": codeHash,
            "inc_token": {
                "symbol": iToken.display_props.symbol,
                "address": incentivizedTokenAddress,
                "decimals": iToken.decimals,
                "name": iToken.display_props.symbol,
                "price": "0"
            },
            "rewards_token": {
                "symbol": rToken.display_props.symbol,
                "address": rewardTokenAddress,
                "decimals": rToken.decimals,
                "name": rToken.display_props.symbol,
                "price": "0"
            },
            "total_locked": "0",
            "pending_rewards": "",
            "deadline": "",
            "hidden": false,
            deprecated: true,
            deprecated_by: "f",
        };

        await Rewards.create(newRewardsDocument);
    }

    
    console.log("Done updating V2 Rewards Pools");
};
