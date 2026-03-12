import axios from "axios";

export async function transcribeAudioChunk(buffer: Buffer): Promise<string> {
  const provider = process.env.STT_PROVIDER || "assemblyai";

  if (provider === "assemblyai") {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      console.warn("ASSEMBLYAI_API_KEY is not set; returning dummy transcript");
      return "Transcription placeholder (configure STT provider to enable real transcription).";
    }

    const resp = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      buffer,
      {
        headers: {
          authorization: apiKey,
          "content-type": "application/octet-stream"
        }
      }
    );

    const uploadUrl = resp.data.upload_url as string;

    await axios.post(
      "https://api.assemblyai.com/v2/transcribe",
      { audio_url: uploadUrl },
      {
        headers: {
          authorization: apiKey,
          "content-type": "application/json"
        }
      }
    );

    return "Transcript requested (implement polling or webhooks for production).";
  }

  return "Transcription placeholder.";
}
