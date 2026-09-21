export default {
  async fetch(request) {
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

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "ai-video-backend"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = String(body.prompt || "").trim();

        if (!prompt) {
          return new Response(
            JSON.stringify({
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

        return new Response(
          JSON.stringify({
            ok: true,
            status: "accepted",
            prompt: prompt,
            message: "Backend received your video request."
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch {
        return new Response(
          JSON.stringify({
            error: "Invalid JSON."
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
    }

    return new Response("AI Video Platform backend is online.", {
      headers: corsHeaders
    });
  }
};
