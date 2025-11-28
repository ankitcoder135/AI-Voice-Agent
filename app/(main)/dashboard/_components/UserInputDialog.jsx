
import React, { useContext } from 'react'
import Image from 'next/image';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea'
import { CoachingExpert } from '@/services/Options';
import { Button } from '@/components/ui/button';


import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { LoaderCircle, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserContext } from '@/app/_context/UserContext';

function UserInputDialog({children, coachingOption}) {
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [topic, setTopic] = useState("");
  const selectedExpertName = selectedExpert !== null ? CoachingExpert[selectedExpert]?.name : "";

  const [openDialog, setOpenDialog] = useState(false);
  const createDiscussionRoom = useMutation(api.DiscussionRoom.createNewRoom);
  const [loading, setLoading] = useState(false);

  const { userData: currentUser } = useContext(UserContext);

  const router = useRouter();

  const onClickNext = async () => {
    setLoading(true);
    const result = await createDiscussionRoom({
        topic: topic,
        coachingOption: coachingOption?.name,
        expertName: selectedExpertName,
        uid: currentUser?._id
    });
    setLoading(false);
    setOpenDialog(false);
    router.push(`/discussion-room/${result}`);
  }
  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{coachingOption.name}</DialogTitle>
          <DialogDescription asChild>
            <div className='mt-3'>
              <h2 className='text-black'>Enter a topic to master your skills in {coachingOption.name}</h2>
              <Textarea
                placeholder={`Enter your topic here...`}
                className="mt-2"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />

              <h2 className='text-black mt-5'>Select your coaching expert</h2>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-6 mt-3">
                {CoachingExpert.map((expert, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div
                      onClick={() => setSelectedExpert(index)}
                      className={
                        `cursor-pointer p-1 rounded-xl transition-all ` +
                        (selectedExpert === index
                          ? 'border-2 border-primary'
                          : 'border-2 border-transparent')
                      }
                    >
                      <Image
                        src={expert.avatar}
                        alt={expert.name}
                        width={80}
                        height={80}
                        className="rounded-xl w-[80px] h-[80px] object-cover aspect-square hover:scale-105 transition-all"
                      />
                    </div>
                    <h2 className='text-center'>{expert.name}</h2>
                  </div>
                ))}
              </div>

              <div className='flex gap-5 justify-end mt-5'>
                <DialogClose asChild>
                    <Button variant={'ghost'}>Cancel</Button>
                </DialogClose>
                <Button disabled={!(topic.trim().length > 0 && selectedExpert !== null && currentUser?._id) || loading} onClick={onClickNext}>
                    {loading && <LoaderCircle className='animate-spin' />}
                    Next</Button>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export default UserInputDialog