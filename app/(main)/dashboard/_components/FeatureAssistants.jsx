"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useUser } from "@stackframe/stack";
import Image from "next/image";
import React from "react";
import { CoachingOptions } from "@/services/Options";
import { BlurFade } from "@/components/ui/blur-fade";
import UserInputDialog from "./UserInputDialog";

function FeatureAssistants() {
  const user = useUser();
  console.log("User in FeatureAssistants:", user);

  return (
    <div className="w-full flex justify-center">
      {/* Centered content container */}
      <div className="w-full max-w-6xl px-4">

        {/* Header */}
        <div className="flex justify-between items-center mt-6 mb-8">
          <div>
            <h2 className="font-medium text-gray-500">My Workspace</h2>
            <h1 className="text-3xl font-bold">
              Welcome back, {user?.displayName || "User"}!
            </h1>
          </div>

          <Button asChild>
            <Link href="/handler/account-settings">Profile</Link>
          </Button>
        </div>

        {/* Cards Grid */}
        <div className="
          grid 
          grid-cols-2 
          sm:grid-cols-3 
          md:grid-cols-4 
          lg:grid-cols-5 
          xl:grid-cols-5 
          gap-6
        ">
          {CoachingOptions.map((option, index) => (
            <UserInputDialog key={index} coachingOption={option}>
              <div
                key={index}
                className="
                  p-5 
                  bg-secondary 
                  rounded-3xl 
                  flex 
                  flex-col 
                  justify-center 
                  items-center 
                  shadow-sm 
                  hover:shadow-md 
                  transition
                "
              >
                <BlurFade key={option.icon} delay={0.25 + index * 0.05} inView>
                  <Image
                    src={option.icon}
                    alt={option.name}
                    width={100}
                    height={100}
                    className="h-[70px] w-[70px] mb-2 hover:rotate-12 cursor-pointer transition-transform"
                  />
                </BlurFade>

                <h2 className="text-center font-medium">{option.name}</h2>
              </div>
            </UserInputDialog>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FeatureAssistants;
