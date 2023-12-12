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

dotenv.config()

const Home = () => {
  const [account, setAccount] = useState<string>('')
  const [spender, setSpender] = useState<string>('')
  const [provider, setProvider] = useState<ethers.providers.Web3Provider>()
  const [approvalAmounts, setApprovalAmmounts] = useState<{
    permitAmount: BigNumber
    expiration: number
    nonce: number
  }>({ permitAmount: BigNumber.from(0), expiration: 0, nonce: 0 })
  const token = '0x4f34BF3352A701AEc924CE34d6CfC373eABb186c'

  const handleApprove = useCallback(async () => {
    try {
      const signer = provider!.getSigner(account)
      const permit2ContractAbi = [
        'function approve(address spender,uint amount)',
      ]
      const permit2Contract = new Contract(token, permit2ContractAbi, signer)
      const tx = await permit2Contract.approve(
        PERMIT2_ADDRESS,
        MaxAllowanceTransferAmount
      )
      await tx.wait()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [account, provider])

  const handleTransfer = useCallback(async () => {
    const signer = provider!.getSigner(spender)
    const permit2ContractAbi = [
      'function transferFrom(address from, address to, uint160 amount, address token)',
    ]
    const permit2Contract = new Contract(token, permit2ContractAbi, signer)
    const tx = await permit2Contract.transferFrom(
      account,
      spender,
      BigNumber.from('1000000000000000000'),
      token
    )
    await tx.wait()
  }, [provider, spender, account])

  const handlePermit = useCallback(async () => {
    const signer = provider!.getSigner(account)
    const allowanceProvider = new AllowanceProvider(provider!, PERMIT2_ADDRESS)
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
        provider!.network.chainId
      )

      const signature = await signTypedData(signer, domain, types, values)

      const permitAbi = [
        'function permit(address owner, tuple(tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details, address spender,uint256 sigDeadline) permitSingle, bytes calldata signature)',
        'function transferFrom(address from, address to, uint160 amount, address token)',
      ]

      const permitContract = new Contract(PERMIT2_ADDRESS, permitAbi, signer)
      await permitContract.permit(account, permitSingle, signature)
    }
    processPermit()
  }, [account, provider, spender])

  const connectWallet = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const address = await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      })
      setProvider(
        new ethers.providers.Web3Provider(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).ethereum
        )
      )
      setAccount(address[0])
      setSpender(address[1])
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }, [])

  /**
   * Get the current allowance amount, expiration, and nonce using the AllowanceProvider.
   * This is the same data that would be used to create a PermitSingle object.
   * You can check permitAmount or expiration on this data to determine whether you need to create a new permit.
   */
  const handleApprovalCheck = useCallback(async () => {
    const allowanceProvider = new AllowanceProvider(provider!, PERMIT2_ADDRESS)
    // Address of the protocol contract that is being approved to spend tokens.
    const SPENDER_ADDRESS = spender
    const processPermit = async () => {
      const {
        amount: permitAmount,
        expiration,
        nonce,
      } = await allowanceProvider.getAllowanceData(
        token,
        account,
        SPENDER_ADDRESS
      )
      setApprovalAmmounts({ permitAmount, expiration, nonce })
    }
    processPermit()
  }, [account, provider, spender])

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
        <>
          <Button onClick={handleApprovalCheck} mb={4}>
            Check Approval Limits
          </Button>
          <Button onClick={handleApprove} mb={4}>
            Authorize Permit2
          </Button>
          <Button onClick={handlePermit}>Permit</Button>
          <Button onClick={handleTransfer}>
            Transfer from Secondary Account
          </Button>
          <Text mb={4}>Account: {account}</Text>
          <Text mb={4}>
            Permitted Amounts: {approvalAmounts.permitAmount.toString()}
          </Text>
          <Text mb={4}>Permitted Expiration: {approvalAmounts.expiration}</Text>
          <Text mb={4}>Permitted Nonce: {approvalAmounts.nonce}</Text>
        </>
      ) : (
        <Button onClick={connectWallet}>Connect Wallet</Button>
      )}
    </Flex>
  )
}

export default Home
