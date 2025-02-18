"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function TapInterface({ peanutCount, lastTap, onTap, inputFid, setInputFid, handleSubmitFid }: { 
  peanutCount: number,
  lastTap: number,
  onTap: () => void,
  inputFid: string,
  setInputFid: (value: string) => void,
  handleSubmitFid: () => void
}) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, 600 - Math.floor((Date.now() - lastTap) / 1000));
      setCooldown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastTap]);

  return (
    <Card className="bg-beige-50 border-brown-200">
      <CardHeader>
        <CardTitle className="text-brown-800">🥜 Nuttap FID</CardTitle>
        <CardDescription className="text-brown-600">
          {inputFid ? `FID: ${inputFid}` : 'Enter your Farcaster FID to start'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {!inputFid ? (
          <div className="flex gap-2 w-full">
            <input
              type="number"
              value={inputFid}
              onChange={(e) => setInputFid(e.target.value)}
              placeholder="Enter FID"
              className="border rounded p-2 flex-1"
            />
            <button 
              onClick={handleSubmitFid}
              className="bg-brown-500 text-white px-4 py-2 rounded hover:bg-brown-600"
            >
              Submit
            </button>
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold text-brown-900">
              {peanutCount} 🥜
            </div>
            <button
              onClick={onTap}
              disabled={cooldown > 0}
              className={`text-6xl p-4 rounded-full transition-all ${
                cooldown > 0 ? 'opacity-50' : 'hover:scale-110'
              }`}
            >
              🥜
            </button>
            <div className="text-sm text-brown-600">
              {cooldown > 0 
                ? `Next tap in ${cooldown}s` 
                : 'Tap the peanut to collect!'}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [peanutCount, setPeanutCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [inputFid, setInputFid] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    const savedFid = localStorage.getItem('nutFid');
    const savedCount = localStorage.getItem('nutCount');
    const savedLastTap = localStorage.getItem('nutLastTap');
    
    if (savedFid) setInputFid(savedFid);
    if (savedCount) setPeanutCount(parseInt(savedCount));
    if (savedLastTap) setLastTap(parseInt(savedLastTap));
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 600 * 1000) return; // 10 minute cooldown
    
    setPeanutCount(prev => {
      const newCount = prev + 1;
      localStorage.setItem('nutCount', newCount.toString());
      return newCount;
    });
    setLastTap(now);
    localStorage.setItem('nutLastTap', now.toString());
    
    // Trigger animation
    setShowAnimation(true);
    setTimeout(() => setShowAnimation(false), 1000);
  }, [lastTap]);

  const handleSubmitFid = useCallback(() => {
    localStorage.setItem('nutFid', inputFid);
  }, [inputFid]);

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        <TapInterface
          peanutCount={peanutCount}
          lastTap={lastTap}
          onTap={handleTap}
          inputFid={inputFid}
          setInputFid={setInputFid}
          handleSubmitFid={handleSubmitFid}
        />
        {showAnimation && (
          <div className="animate-bounce absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">
            +1 🥜!
          </div>
        )}
      </div>
    </div>
  );
}
