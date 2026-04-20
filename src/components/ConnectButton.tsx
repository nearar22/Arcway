"use client";
import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";

export default function ConnectButton() {
  return (
    <RKConnectButton
      showBalance={true}
      chainStatus="icon"
      accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
    />
  );
}
