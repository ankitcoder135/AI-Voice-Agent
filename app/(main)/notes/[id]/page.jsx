"use client";

import React, { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const AB_IMAGES = ["/ab1.png", "/ab2.png", "/ab3.png", "/ab4.png", "/ab5.png"];

function relativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

function pickAbstractStable(id) {
  if (!id) return AB_IMAGES[0];
  let sum = 0;
  for (let i = 0; i < String(id).length; i++) sum = (sum + String(id).charCodeAt(i)) % 9973;
  return AB_IMAGES[sum % AB_IMAGES.length];
}

export default function NotesViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const room = useQuery(api.DiscussionRoom.getDiscussionRoom, id ? { id } : undefined);

  const convo = useMemo(() => (Array.isArray(room?.conversation) ? room.conversation : []), [room]);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Image src={pickAbstractStable(room?._id)} alt="topic" width={56} height={56} className="rounded-full w-14 h-14 object-cover" />
            <div>
              <h2 className="text-xl font-semibold">{room?.topic || "Topic"}</h2>
              <p className="text-sm text-gray-500">{room?.coachingOption || "Coaching Option"}</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">{relativeTime(room?._creationTime)}</div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Notes/Feedback Card */}
          <div
            className="rounded-2xl bg-white/90 dark:bg-slate-900/70 p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10
                       transition-all duration-300 transform-gpu hover:-translate-y-1 hover:shadow-2xl"
          >
            <h3 className="font-semibold mb-3">Notes</h3>
            {room?.feedback ? (
              <div className="space-y-4 max-h-[60vh] overflow-auto no-scrollbar">
                {room.feedback.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Summary</h4>
                    <p className="text-sm leading-6 text-gray-800 dark:text-gray-200">{room.feedback.summary}</p>
                  </div>
                )}
                {Array.isArray(room.feedback.notes) && room.feedback.notes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Key Notes</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800 dark:text-gray-200">
                      {room.feedback.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(room.feedback.action_items) && room.feedback.action_items.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Action Items</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800 dark:text-gray-200">
                      {room.feedback.action_items.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!room.feedback.summary && (!room.feedback.notes || room.feedback.notes.length === 0) && (
                  <p className="text-sm text-gray-500">No notes generated yet.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No notes generated yet.</p>
            )}
          </div>

          {/* Chatbox (read-only) */}
          <div
            className="rounded-2xl bg-white/90 dark:bg-slate-900/70 p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10
                       transition-all duration-300 transform-gpu hover:-translate-y-1 hover:shadow-2xl"
          >
            <h3 className="font-semibold mb-3">Chatbox</h3>
            <div className="max-h-[60vh] overflow-auto no-scrollbar space-y-3">
              {convo.length === 0 && (
                <p className="text-sm text-gray-500">No messages yet.</p>
              )}
              {convo.map((m, idx) => (
                <div key={idx} className={`${(m.role||'').toLowerCase()==='assistant' ? 'justify-start' : 'justify-end'} flex`}>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${ (m.role||'').toLowerCase()==='assistant' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-primary/10 text-primary-900 dark:text-primary-100' } max-w-[80%]`}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </div>
    </div>
  );
}
