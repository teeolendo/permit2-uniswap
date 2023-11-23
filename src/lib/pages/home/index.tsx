'use client'

import { Flex, Text, Button } from '@chakra-ui/react'
import { signTypedData } from '@uniswap/conedison/provider/index'
import type { PermitSingle } from '@uniswap/Permit2-sdk'
import {
  AllowanceProvider,
  PERMIT2_ADDRESS,
  MaxAllowanceTransferAmount,
  AllowanceTransfer,
} from '@uniswap/Permit2-sdk'
import * as dotenv from 'dotenv'
import { ethers, Contract, BigNumber } from 'ethers'
import { useState, useCallback } from 'react'

/**
 * Converts an expiration (in milliseconds) to a deadline (in seconds) suitable for the EVM.
 * Permit2 expresses expirations as deadlines, but JavaScript usually uses milliseconds,
 * so this is provided as a convenience function.
 */
function toDeadline(expiration: number): number {
  return Math.floor((Date.now() + expiration) / 1000)
}

/**
 * Approves the given token to spend the maximum amount of tokens on behalf of the given account.
 * This is a convenience function for testing purposes.
 * @param token The token to approve.
 * @param account The account that will approve the token.
 
async function approvePermit2(token: string, signer: ethers.Signer) {
  const permit2ContractAbi = ['function approve(address spender,uint amount)']
  const permit2Contract = new Contract(token, permit2ContractAbi, signer)
  const tx = await permit2Contract.approve(
    PERMIT2_ADDRESS,
    MaxAllowanceTransferAmount
  )
  await tx.wait()
}
*/

dotenv.config()

const Home = () => {
  const [account, setAccount] = useState<string>('')
  const [spender, setSpender] = useState<string>('')

  const handleApprove = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new ethers.providers.Web3Provider((window as any).ethereum)
    const signer = provider.getSigner(account)
    const allowanceProvider = new AllowanceProvider(provider, PERMIT2_ADDRESS)
    const token = '0x4f34BF3352A701AEc924CE34d6CfC373eABb186c'
    // Address of the protocol contract that is being approved to spend tokens.
    const SPENDER_ADDRESS = spender
    const processPermit = async () => {
      /**
       * Get the current allowance amount, expiration, and nonce using the AllowanceProvider.
       * This is the same data that would be used to create a PermitSingle object.
       * You can check permitAmount or expiration on this data to determine whether you need to create a new permit.
       */
      const {
        // amount: permitAmount,
        // expiration,
        nonce,
      } = await allowanceProvider.getAllowanceData(
        token,
        account,
        SPENDER_ADDRESS
      )

      /**
       * Create a PermitSingle object with the maximum allowance amount, and a deadline 30 days in the future.
       */
      const permitSingle: PermitSingle = {
        details: {
          token,
          amount: MaxAllowanceTransferAmount,
          expiration: toDeadline(/* 30 days= */ 1000 * 60 * 60 * 24 * 30),
          nonce,
        },
        spender: SPENDER_ADDRESS,
        sigDeadline: toDeadline(/* 30 mins= */ 1000 * 60 * 60 * 30),
      }

      const { domain, types, values } = AllowanceTransfer.getPermitData(
        permitSingle,
        PERMIT2_ADDRESS,
        provider.network.chainId
      )

      const signature = await signTypedData(signer, domain, types, values)

      const permitAbi = [
        'function permit(address owner, PermitSingle calldata permitSingle, bytes calldata signature)',
        'function transferFrom(address from, address to, uint160 amount, address token)',
      ]

      const polContract = new Contract(token, permitAbi, provider.getSigner())
      await polContract.permit(account, permitSingle, signature)
      await polContract.transferFrom(
        account,
        SPENDER_ADDRESS,
        BigNumber.from('10000000000000000000')
      )
    }
    processPermit()
  }, [account, spender])

  const connectWallet = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const address = await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      })
      setAccount(address[0])
      setSpender(address[1])
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [])

  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      minHeight="70vh"
      gap={4}
      mb={8}
      w="full"
    >
      <Text mb={4}>Welcome</Text>
      {account ? (
        <Button onClick={handleApprove}>Permit</Button>
      ) : (
        <Button onClick={connectWallet}>Connect Wallet</Button>
      )}
    </Flex>
  )
}

export default Home
