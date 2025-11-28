"use client"

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { useUser } from "@stackframe/stack";
import { CoachingExpert } from "@/services/Options";
import { Button } from "@/components/ui/button";
import { UserButton } from "@stackframe/stack";
import RecordRTC from "recordrtc";
import { StreamingTranscriber } from "assemblyai";
import { getToken, AIModel } from "@/services/GlobalServices";
import { updateConversation } from "@/convex/DiscussionRoom";

function DiscussionRoom() {
  const roomId = useParams().roomId;
  const discussionRoomData = useQuery(api.DiscussionRoom.getDiscussionRoom, { id: roomId });
  const [expert, setExpert] = useState(null);
  const [enableMic, setEnableMic] = useState(false);
  const user = useUser();

  // Core refs
  const recorder = useRef(null);
  const transcriber = useRef(null);
  const chatContainerRef = useRef(null);
  const lastMessageEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioPlayerRef = useRef(null); // For TTS playback
  
  // Control refs
  const processingResponseRef = useRef(false);
  const isListeningPausedRef = useRef(false);
  const isSpeakingRef = useRef(false); // Track if AI is speaking
  
  // Deduplication: track last finalized text with timestamp
  const lastFinalizedRef = useRef({ text: "", timestamp: 0 });

  // Conversation state - single source of truth
  const [conversationHistory, setConversationHistory] = useState([]);
  const [livePartial, setLivePartial] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // UI state for speaking
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [allowGenerate, setAllowGenerate] = useState(false); // Show Generate only after disconnect
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: string }

  const updateConversation = useMutation(api.DiscussionRoom.updateConversation);

  // Load expert data
  useEffect(() => {
    if (discussionRoomData) {
      const foundExpert = CoachingExpert.find((item) => item.name === discussionRoomData.expertName);
      setExpert(foundExpert);
    }
  }, [discussionRoomData]);

  // Auto-scroll on conversation updates
  useEffect(() => {
    const timer = setTimeout(() => {
      lastMessageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
    return () => clearTimeout(timer);
  }, [conversationHistory, livePartial, isAssistantTyping, isSpeaking]);

  // Simple text normalization for deduplication
  const normalizeText = (text) => {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  };

  // Build clean history for AI (filter out empty messages)
  const buildAIHistory = useCallback((history) => {
    return history
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => ({
        role: msg.role === "Assistant" ? "assistant" : "user",
        content: msg.content
      }));
  }, []);

  const handleGenerateNotes = useCallback(async () => {
    if (!discussionRoomData) return;
    try {
      setIsGeneratingNotes(true);
      const res = await fetch('/api/generateNotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          topic: discussionRoomData?.topic,
          coachingOption: discussionRoomData?.coachingOption,
          expertName: discussionRoomData?.expertName,
          conversation: conversationHistory,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate notes/feedback');
      const data = await res.json();
      console.log('✅ Notes/Feedback generated & saved:', data);
      setNotification({ type: 'success', message: 'Notes/Feedback generated successfully.' });
      setTimeout(() => setNotification(null), 4000);
      // Intentionally not showing a UI notification yet
    } catch (e) {
      console.error('❌ Notes/Feedback generation failed:', e);
      setNotification({ type: 'error', message: 'Failed to generate notes/feedback.' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [discussionRoomData, conversationHistory, roomId]);

  // Text-to-Speech function
  const speakText = useCallback(async (text, expertName) => {
    try {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      
      console.log("🔊 Generating speech for:", text.substring(0, 50) + "...");

      // Call your TTS API endpoint
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          expertName,
        }),
      });

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      const data = await response.json();

      if (!data.success || !data.audio) {
        throw new Error('Invalid TTS response');
      }

      // Convert base64 to blob
      const audioBlob = await fetch(`data:${data.mimeType};base64,${data.audio}`).then(r => r.blob());
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element and play
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }

      const audio = audioPlayerRef.current;
      audio.src = audioUrl;

      // Handle playback events
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          console.log("✅ Speech playback completed");
          URL.revokeObjectURL(audioUrl);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          resolve();
        };

        audio.onerror = (error) => {
          console.error("Audio playback error:", error);
          URL.revokeObjectURL(audioUrl);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          reject(error);
        };

        audio.play().catch(err => {
          console.error("Failed to play audio:", err);
          URL.revokeObjectURL(audioUrl);
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          reject(err);
        });
      });

    } catch (error) {
      console.error("Text-to-Speech error:", error);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      // Don't throw - just log and continue
    }
  }, []);

  // Stop any ongoing speech
  const stopSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Pause/resume listening
  const pauseListening = useCallback(() => {
    isListeningPausedRef.current = true;
    setConnectionStatus("Connected — Paused");
  }, []);

  const resumeListening = useCallback(() => {
    isListeningPausedRef.current = false;
    setConnectionStatus("Connected");
  }, []);

  // Animated typing effect for assistant response
  const typeOutAssistant = useCallback((fullText) => {
    return new Promise((resolve) => {
      if (!fullText) {
        resolve();
        return;
      }

      const tokens = fullText.match(/\s+|\S+/g) || [];
      let currentIndex = 0;

      // Add empty assistant message
      setConversationHistory(prev => [...prev, { role: "Assistant", content: "" }]);
      setIsAssistantTyping(true);

      const interval = setInterval(() => {
        currentIndex++;
        
        setConversationHistory(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "Assistant") {
            lastMsg.content = tokens.slice(0, currentIndex).join("");
          }
          return updated;
        });

        if (currentIndex >= tokens.length) {
          clearInterval(interval);
          setIsAssistantTyping(false);
          resolve();
        }
      }, 25);
    });
  }, []);

  // Handle AI response - now properly memoized to prevent duplicate calls
  const handleAIResponse = useCallback(async (userMessage, currentHistory) => {
    // Guard: if already processing, don't start another request
    if (processingResponseRef.current) {
      console.log("⏭️ Already processing, skipping duplicate AI call");
      return;
    }

    try {
      if (!discussionRoomData?.topic || !discussionRoomData?.coachingOption) {
        processingResponseRef.current = false;
        return;
      }

      // Mark as processing IMMEDIATELY
      processingResponseRef.current = true;
      pauseListening();
      setIsAssistantTyping(true);

      // Stop any ongoing speech
      stopSpeaking();

      // Build clean history for AI
      const aiHistory = buildAIHistory(currentHistory);

      console.log("🤖 Getting AI response for:", userMessage);

      // Call AI model
      const completion = await AIModel(
        discussionRoomData.topic,
        discussionRoomData.coachingOption,
        userMessage,
        aiHistory
      );

      let assistantText = completion?.response?.content || "I'm here. Could you please repeat that?";

      // Type out the response
      await typeOutAssistant(assistantText);
      console.log("✅ AI response completed");

      // Now speak the response using TTS
      const expertName = expert?.name || discussionRoomData?.expertName || "";
      await speakText(assistantText, expertName);

    } catch (err) {
      console.error("AI response error:", err);
      setConversationHistory(prev => [
        ...prev,
        { role: "Assistant", content: "Sorry, I had trouble responding. Please try again." }
      ]);
      setIsAssistantTyping(false);
    } finally {
      processingResponseRef.current = false;
      // Only resume if not currently speaking
      if (transcriber.current && !isSpeakingRef.current) {
        resumeListening();
      }
    }
  }, [discussionRoomData, expert, buildAIHistory, pauseListening, resumeListening, typeOutAssistant, speakText, stopSpeaking]);

  const connectToServer = async () => {
    setAllowGenerate(false);
    setIsConnecting(true);
    setConnectionStatus("Connecting...");
    isListeningPausedRef.current = false;
    processingResponseRef.current = false;

    try {
      const token = await getToken();
      if (!token) throw new Error("Failed to get AssemblyAI token");

      // Initialize transcriber with 5s silence threshold
      transcriber.current = new StreamingTranscriber({
        token,
        sampleRate: 16000,
        endUtteranceSilenceThreshold: 5000,
      });

      // Session opened
      transcriber.current.on("open", ({ id }) => {
        console.log("✅ Realtime session opened", id);
        setConnectionStatus("Connected");
        setEnableMic(true);
        setIsConnecting(false);
        isListeningPausedRef.current = false;
        lastFinalizedRef.current = { text: "", timestamp: 0 };
      });

      // Handle transcription turns
      transcriber.current.on("turn", (payload) => {
        try {
          const partialText = (payload?.utterance || payload?.transcript || "").trim();
          const isFinal = !!payload?.end_of_turn;
          const finalText = isFinal ? (payload?.transcript || "").trim() : "";

          // Update live partial as user speaks
          if (partialText && !isFinal) {
            setLivePartial(partialText);
          }

          // Process final text when turn ends
          if (isFinal && finalText) {
            // Guard: don't process if already handling a response OR if AI is speaking
            if (processingResponseRef.current || isSpeakingRef.current) {
              console.log("⏭️ Already processing or AI speaking, ignoring new turn");
              return;
            }

            const now = Date.now();
            const normalized = normalizeText(finalText);
            
            // Deduplication: ignore if same text within 3 seconds
            if (
              normalized === normalizeText(lastFinalizedRef.current.text) &&
              now - lastFinalizedRef.current.timestamp < 3000
            ) {
              console.log("⏭️ Skipping duplicate:", finalText);
              return;
            }

            // Update dedup tracker
            lastFinalizedRef.current = { text: finalText, timestamp: now };
            
            // Clear live partial
            setLivePartial("");
            
            // Add user message
            setConversationHistory(prev => {
              const updated = [...prev, { role: "User", content: finalText }];
              
              // Trigger AI response OUTSIDE of state update using setTimeout
              // This prevents React StrictMode from calling it twice
              setTimeout(() => {
                handleAIResponse(finalText, updated);
              }, 0);
              
              return updated;
            });
          }
        } catch (err) {
          console.error("Turn handling error:", err);
        }
      });

      // Error handling
      transcriber.current.on("error", (err) => {
        console.error("StreamingTranscriber error:", err);
        setConnectionStatus("Error: " + (err?.message || "unknown"));
        setEnableMic(false);
        setIsConnecting(false);
      });

      // Close handling
      transcriber.current.on("close", (code, reason) => {
        console.log("🔴 Transcriber closed:", code, reason);
        setConnectionStatus("Disconnected");
        setEnableMic(false);
        setIsConnecting(false);
      });

      // Connect transcriber
      await transcriber.current.connect();
      console.log("Connected to AssemblyAI realtime");

      // Setup microphone with audio processing
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = rawStream;

      // Create audio processing pipeline
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(rawStream);

      // High-pass filter to remove low-frequency noise
      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 120;

      // Compressor for vocal consistency
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      // Simple noise gate
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      const gateThreshold = 0.01;
      
      scriptNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);

        // Gate: mute if below threshold
        if (rms < gateThreshold) {
          output.fill(0);
        } else {
          output.set(input);
        }
      };

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0;

      const destination = audioCtx.createMediaStreamDestination();

      // Connect audio graph
      source.connect(hpFilter);
      hpFilter.connect(compressor);
      compressor.connect(scriptNode);
      scriptNode.connect(gainNode);
      gainNode.connect(destination);

      // Start recording with RecordRTC
      recorder.current = new RecordRTC(destination.stream, {
        type: "audio",
        mimeType: "audio/webm;codecs=pcm",
        recorderType: RecordRTC.StereoAudioRecorder,
        timeSlice: 250,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
        bufferSize: 4096,
        audioBitsPerSecond: 128000,
        ondataavailable: async (blob) => {
          if (!transcriber.current || isListeningPausedRef.current) return;
          
          try {
            const buffer = await blob.arrayBuffer();
            transcriber.current.sendAudio(buffer);
          } catch (err) {
            console.error("Error sending audio chunk:", err);
          }
        },
      });

      recorder.current.startRecording();
      console.log("🎙️ Recording started");
      
    } catch (err) {
      console.error("connectToServer error:", err);
      setConnectionStatus("Error: " + (err?.message || "connection failed"));
      setEnableMic(false);
      setIsConnecting(false);
    }
  };

  const stopAndReleaseMedia = () => {
    // Stop recorder
    if (recorder.current) {
      try {
        recorder.current.stopRecording(() => {
          recorder.current?.stream?.getTracks().forEach(t => t.stop());
          recorder.current = null;
        });
      } catch {
        recorder.current = null;
      }
    }

    // Stop raw media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop any ongoing speech
    stopSpeaking();
  };

  const disconnect = async () => {
    console.log("Disconnecting...");
    setConnectionStatus("Disconnecting...");

    try {
      stopAndReleaseMedia();

      if (transcriber.current) {
        await transcriber.current.close();
        transcriber.current = null;
      }

      await updateConversation({ 
        id: roomId, 
        conversation: conversationHistory 
      });
      
    } catch (err) {
      console.error("disconnect error:", err);
    } finally {
      setEnableMic(false);
      setConnectionStatus("Disconnected");
      setAllowGenerate(true);
      setLivePartial("");
      processingResponseRef.current = false;
      isListeningPausedRef.current = false;
      isSpeakingRef.current = false;
      lastFinalizedRef.current = { text: "", timestamp: 0 };
      setIsConnecting(false);
      setIsAssistantTyping(false);
      setIsSpeaking(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Status color helper
  const getStatusColor = (status) => {
    const s = String(status || "");
    if (s.startsWith("Connected — Paused")) return "bg-orange-500";
    if (s.startsWith("Connected")) return "bg-green-500";
    if (s.startsWith("Connecting") || s.startsWith("Disconnecting")) return "bg-orange-500";
    if (s.startsWith("Error") || s === "Disconnected") return "bg-red-500";
    return "bg-gray-400";
  };

  return (
    <div className="-mt-12 min-h-screen bg-white px-4 pt-8">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg text-white ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">{notification.message}</span>
            <button
              className="text-white/90 text-xs underline"
              onClick={() => setNotification(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {discussionRoomData ? `${discussionRoomData.coachingOption}: ${discussionRoomData.topic}` : "Loading..."}
        </h2>
        <div className="p-2 bg-gray-100 rounded-lg flex items-center gap-2 text-sm">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${getStatusColor(connectionStatus)}`}></span>
          <span className="font-semibold">Status:</span> {connectionStatus}
          {isSpeaking && (
            <span className="flex items-center gap-1 text-blue-600">
              <span className="animate-pulse">🔊</span>
              <span>AI Speaking</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Expert Card */}
        <div className="lg:col-span-2 h-[60vh] bg-secondary border rounded-4xl flex flex-col items-center justify-center relative">
          {expert?.avatar ? (
            <Image
              src={expert.avatar}
              alt="Avatar"
              width={200}
              height={200}
              className={`h-[80px] w-[80px] rounded-full object-cover ${isSpeaking ? 'animate-pulse ring-4 ring-blue-400' : 'animate-pulse'}`}
            />
          ) : (
            <div className={`h-[80px] w-[80px] rounded-full bg-gray-300 ${isSpeaking ? 'animate-pulse ring-4 ring-blue-400' : 'animate-pulse'}`} />
          )}
          <h2 className="text-gray-500 mt-2">{expert?.name || "Loading..."}</h2>
          {isSpeaking && (
            <div className="mt-2 text-sm text-blue-600 font-medium">Speaking...</div>
          )}
          <div className="p-5 bg-gray-200 px-10 rounded-lg absolute bottom-10 right-10">
            <UserButton />
          </div>
        </div>

        {/* Chat Section */}
        <div
          ref={chatContainerRef}
          className="h-[60vh] bg-secondary border rounded-4xl flex flex-col p-4 overflow-y-auto no-scrollbar"
        >
          <h2 className="font-semibold mb-4">Chat Section</h2>
          <div className="flex-1 space-y-2">
            {conversationHistory.length === 0 && !livePartial && (
              <p className="text-gray-400 text-sm">No messages yet. Start speaking...</p>
            )}

            {/* Conversation messages */}
            {conversationHistory.map((msg, index) => {
              const isUser = msg.role === "User";
              const userAvatarSrc = user?.profileImageUrl || "/eduvi-logo.png";
              const avatarSrc = isUser ? userAvatarSrc : expert?.avatar || "/t1.avif";
              
              return (
                <div key={index} className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                  {isUser ? (
                    <img
                      src={avatarSrc}
                      alt="You avatar"
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <Image
                      src={avatarSrc}
                      alt={`${msg.role} avatar`}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className={`p-2 rounded-lg max-w-[80%] ${isUser ? "bg-blue-50" : "bg-white"}`}>
                    <span className="font-semibold text-sm">
                      {isUser ? "You" : expert?.name || "Assistant"}:
                    </span>{" "}
                    <span className="text-sm whitespace-pre-wrap">{msg.content}</span>
                  </div>
                </div>
              );
            })}

            {/* Live partial (user speaking) */}
            {livePartial && (
              <div className="flex items-start gap-3 flex-row-reverse">
                <img
                  src={user?.profileImageUrl || "/eduvi-logo.png"}
                  alt="You"
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                />
                <div className="p-2 bg-blue-50 rounded-lg border-2 border-blue-200 border-dashed max-w-[80%]">
                  <span className="font-semibold text-sm text-blue-700">You (speaking):</span>{" "}
                  <span className="text-sm text-blue-900">{livePartial}</span>
                </div>
              </div>
            )}

            {/* Assistant typing indicator */}
            {isAssistantTyping && conversationHistory[conversationHistory.length - 1]?.role !== "Assistant" && (
              <div className="flex items-start gap-3">
                <Image
                  src={expert?.avatar || "/t1.avif"}
                  alt="Assistant"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover flex-shrink-0 animate-pulse"
                />
                <div className="p-2 bg-gray-100 rounded-lg max-w-[80%]">
                  <span className="font-semibold text-sm">{expert?.name || "Assistant"}:</span>{" "}
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={lastMessageEndRef} />
          </div>
        </div>

        {/* Generate Notes/Feedback below chat */}
        {/* Buttons moved to a separate centered row below */}
      </div>

      {/* Centered Controls Row */}
      <div className="w-full flex items-center justify-center mt-8 gap-3">
        {!enableMic && !isConnecting ? (
          <Button onClick={connectToServer}>Connect</Button>
        ) : isConnecting ? (
          <Button disabled>Connecting...</Button>
        ) : (
          <Button variant="destructive" onClick={disconnect}>
            Disconnect
          </Button>
        )}
        {allowGenerate && (
          <Button onClick={handleGenerateNotes} disabled={isGeneratingNotes || conversationHistory.length === 0}>
            {isGeneratingNotes ? 'Generating…' : 'Generate Notes/Feedback'}
          </Button>
        )}
      </div>

      <div className="w-full flex items-center justify-center mb-0 mt-2">
        <p className="text-xs text-gray-400 text-center max-w-lg mb-0">
          At the end of your conversation we will automatically generate feedback/notes from your conversation
        </p>
      </div>
    </div>
  );
}

export default DiscussionRoom;