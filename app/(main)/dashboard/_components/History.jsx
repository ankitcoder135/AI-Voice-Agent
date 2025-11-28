"use client";

import Image from 'next/image';
import React, { useContext, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { UserContext } from '@/app/_context/UserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const AB_IMAGES = ['/ab1.png','/ab2.png','/ab3.png','/ab4.png','/ab5.png'];

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h>1?'s':''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d>1?'s':''} ago`;
}

function pickAbstractStable(id) {
  if (!id) return AB_IMAGES[0];
  let sum = 0;
  for (let i = 0; i < String(id).length; i++) sum = (sum + String(id).charCodeAt(i)) % 9973;
  return AB_IMAGES[sum % AB_IMAGES.length];
}

function History() {
  const router = useRouter();
  const { userData: currentUser } = useContext(UserContext);
  const rooms = useQuery(api.DiscussionRoom.getAllDiscussionRoom, currentUser?._id ? { uid: currentUser._id } : undefined);

  const lectureItems = useMemo(() => {
    const all = Array.isArray(rooms) ? rooms : [];
    return all.filter(r => {
      const name = (r.coachingOption || '').toLowerCase();
      // Exclude Interview/Q&A; keep the other three
      return !(name.includes('interview') || name.includes('ques ans'));
    }).sort((a,b) => (b._creationTime||0) - (a._creationTime||0));
  }, [rooms]);

  return (
    <div>
      <h2 className='font-bold text-xl'>Your Previous Lectures</h2>
      {(!lectureItems || lectureItems.length === 0) && (
        <h2 className='text-gray-500 mt-2'>You don't have any previous lectures</h2>
      )}

      <div className='mt-4 space-y-4'>
        {lectureItems?.map(item => (
          <div
            key={item._id}
            className='
              group relative flex items-center justify-between
              rounded-2xl bg-white/90 dark:bg-slate-900/70 p-4
              shadow-sm ring-1 ring-black/5 dark:ring-white/10
              transition-all duration-300 transform-gpu
              hover:-translate-y-1 hover:scale-[1.01] hover:shadow-2xl
            '
          >
            <div className='flex items-center gap-3'>
              <Image src={pickAbstractStable(item._id)} alt='lecture' width={48} height={48} className='rounded-xl w-12 h-12 object-cover shadow-sm'/>
              <div>
                <h3 className='font-semibold'>{item.topic}</h3>
                <p className='text-sm text-gray-500'>{item.coachingOption}</p>
              </div>
            </div>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-gray-500'>{relativeTime(item._creationTime)}</span>
              <Button
                variant='secondary'
                className='
                  opacity-100 md:opacity-0 md:pointer-events-none
                  md:group-hover:opacity-100 md:group-hover:pointer-events-auto
                  transition-all duration-200 translate-y-0 md:translate-y-1 md:group-hover:translate-y-0
                '
                onClick={() => router.push(`/notes/${item._id}`)}
              >
                View Notes
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default History;