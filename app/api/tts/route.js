import textToSpeech from '@google-cloud/text-to-speech';
import { NextResponse } from 'next/server';



const client = new textToSpeech.TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});

export async function POST(request) {
  try {
    const { text, expertName } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Determine voice based on expert name
    const isVyom = expertName?.toLowerCase() === 'vyom';
    
    // Voice configuration
    const voiceConfig = isVyom
      ? {
          languageCode: 'en-US',
          name: 'en-US-Neural2-D',
          ssmlGender: 'MALE',
        }
      : {
          // Female voice for others
          languageCode: 'en-US',
          name: 'en-US-Neural2-F',
          ssmlGender: 'FEMALE',
        };


    // Construct the request
    const ttsRequest = {
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.5, // 1.5x speed
        pitch: 0.0, // Normal pitch
        volumeGainDb: 0.0, // Normal volume
        effectsProfileId: ['headphone-class-device'], // Optimize for headphones
      },
    };

    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(ttsRequest);

    // Return the audio content as base64
    const audioContent = response.audioContent.toString('base64');

    return NextResponse.json({
      success: true,
      audio: audioContent,
      mimeType: 'audio/mpeg',
    });

  } catch (error) {
    console.error('Text-to-Speech error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        details: error.message 
      },
      { status: 500 }
    );
  }
}