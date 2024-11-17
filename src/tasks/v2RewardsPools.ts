import { CosmWasmClient } from "secretjs";
import config from "../util/config";
import { Rewards } from "../models/Rewards";
import { TokenInfoResponse } from "./tokens";
import axios from "axios";

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

        const existingDocument = await Rewards.findOne({ pool_address: contract_address }).lean();
        if (existingDocument) {
            console.log("Skipping V2 pool", contract.label, contract_address);
            continue;
        }
        
        console.log("Updating V2 pool", contract.label, contract_address);

        const itr: IncentivizedTokenResponse = await queryClient.queryContractSmart(contract_address, { incentivized_token: {} });
        const incentivizedTokenAddress = itr.incentivized_token.token.address;
        const { token_info: incentivizedTokenInfo }: TokenInfoResponse = await queryClient.queryContractSmart(incentivizedTokenAddress, { token_info: {}});

        const { reward_token: { token: { address: rewardTokenAddress }}}: RewardTokenResponse = await queryClient.queryContractSmart(contract_address, { reward_token: {} });
        const { token_info: rewardTokenInfo }: TokenInfoResponse = await queryClient.queryContractSmart(rewardTokenAddress, { token_info: {}});
        

        const newRewardsDocument = {
            "pool_address": contract_address,
            "contract_hash": codeHash,
            "inc_token": {
                "symbol": incentivizedTokenInfo.symbol,
                "address": incentivizedTokenAddress,
                "decimals": incentivizedTokenInfo.decimals,
                "name": incentivizedTokenInfo.name,
                "price": "0"
            },
            "rewards_token": {
                "symbol": rewardTokenInfo.symbol,
                "address": rewardTokenAddress,
                "decimals": rewardTokenInfo.decimals,
                "name": rewardTokenInfo.name,
                "price": "0"
            },
            "total_locked": "0",
            "pending_rewards": "",
            "deadline": "",
            "hidden": false,
        };

        await Rewards.create(newRewardsDocument);
    }

    
    console.log("Done updating V2 Rewards Pools");
};
