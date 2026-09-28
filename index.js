export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "ai-video-backend",
          ai: "connected"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
// Video model availability test
if (url.pathname === "/video-model-test" && request.method === "GET") {
  return new Response(
    JSON.stringify({
      ok: true,
      model: "pruna/p-video",
      ready: true,
      generation: false,
      message: "Video model route is configured. No video was generated."
    }),
    {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}
    // AI Video generation request
    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const body = await request.json();

        const prompt = String(body.prompt || "").trim();
        const style = String(body.style || "default");
        const voice = String(body.voice || "default");
        const music = String(body.music || "default");
        const sound = String(body.sound || "default");
        const duration = String(body.duration || "default");
        const hasImage = Boolean(body.hasImage);

        if (!prompt) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Prompt is required."
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const aiPrompt = `
You are the AI director for an advanced AI video-generation platform.

Create a concise production plan for this video request.

User prompt:
${prompt}

Video style:
${style}

Voice:
${voice}

Music:
${music}

Sound effects:
${sound}

Duration:
${duration} seconds

Image provided:
${hasImage ? "Yes" : "No"}

Return:
1. Video concept
2. Scene description
3. Camera movement
4. Visual style
5. Voice direction
6. Music direction
7. Sound effects
8. Final generation prompt

Keep the answer practical for a future video-generation engine.
`;

        const aiResponse = await env.AI.run(
          "@cf/meta/llama-3.2-3b-instruct",
          {
            messages: [
              {
                role: "system",
                content:
                  "You are a professional AI video director. Create clear, useful production plans for video generation."
              },
              {
                role: "user",
                content: aiPrompt
              }
            ]
          }
        );

        return new Response(
          JSON.stringify({
            ok: true,
            status: "ai-generated",
            message: aiResponse.response || "AI generated the video plan.",
            settings: {
              style,
              voice,
              music,
              sound,
              duration,
              hasImage
            }
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "AI generation failed.",
            details: error.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }

    return new Response(
      "AI Video Platform backend is online.",
      {
        headers: corsHeaders
      }
    );
  }
};
