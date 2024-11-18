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
export const updateV1RewardsPools = async () => {
    console.log("Updating V1 Rewards Pools");

    const queryClient = new CosmWasmClient(config.secretNodeUrl);

    const contracts = await queryClient.getContracts(38);
    const codeHash = await queryClient.getCodeHashByCodeId(38);
    console.log(`Found ${contracts.length} V1 rewards pools on-chain`);
    const noAddress = contracts.filter(c => !c.address);
    console.log(`${noAddress.length} V1 rewards pools do not have an address`);

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
            console.log("Skipping V1 pool", contract.label, contract_address);
            continue;
        }
        
        console.log("Updating V1 pool", contract.label, contract_address);

        const itr: IncentivizedTokenResponse = await queryClient.queryContractSmart(contract_address, { incentivized_token: {} });
        const incentivizedTokenAddress = itr.incentivized_token.token.address;
        const iToken = await Tokens.findOne({address: incentivizedTokenAddress}).lean();

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

    
    console.log("Done updating V1 Rewards Pools");
};
