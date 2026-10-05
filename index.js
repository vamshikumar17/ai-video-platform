export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-Video-Test-Secret"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // =========================================================
    // HEALTH CHECK
    // =========================================================

    if (
      url.pathname === "/health" &&
      request.method === "GET"
    ) {
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

    // =========================================================
    // SAFE VIDEO MODEL TEST
    // Does NOT generate a video.
    // =========================================================

    if (
      url.pathname === "/video-model-test" &&
      request.method === "GET"
    ) {
      return new Response(
        JSON.stringify({
          ok: true,
          model: "pruna/p-video",
          ready: true,
          generation: false,
          message:
            "Video model route is configured. No video was generated."
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // =========================================================
    // CLOUDFLARE P-VIDEO TEST ROUTE
    // Protected by VIDEO_TEST_SECRET.
    // =========================================================

    if (
      url.pathname === "/generate-video" &&
      request.method === "POST"
    ) {
      try {
        const providedSecret =
          request.headers.get("X-Video-Test-Secret");

        if (
          !env.VIDEO_TEST_SECRET ||
          providedSecret !== env.VIDEO_TEST_SECRET
        ) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Unauthorized video generation request."
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const body = await request.json();

        if (body.testGeneration !== true) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Real video generation requires testGeneration: true."
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const prompt =
          String(body.prompt || "").trim();

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

        const video = await env.AI.run(
          "pruna/p-video",
          {
            prompt,
            duration: 5,
            resolution: "720p",
            aspect_ratio: "16:9",
            draft: true
          }
        );

        return new Response(
          JSON.stringify({
            ok: true,
            status: "video-generated",
            video
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
            error: "Video generation failed.",
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

    // =========================================================
    // AI PRODUCTION PLAN
    // This uses Workers AI and does NOT call Magic Hour.
    // =========================================================

    if (
      url.pathname === "/generate" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const turnstileToken =
          String(body.turnstileToken || "").trim();

        if (!turnstileToken) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Security verification is required."
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        const turnstileResponse = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              secret: env.TURNSTILE_SECRET_KEY,
              response: turnstileToken
            })
          }
        );

        const turnstileResult =
          await turnstileResponse.json();

        if (!turnstileResult.success) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Security verification failed."
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }
        const prompt =
          String(body.prompt || "").trim();

        const style =
          String(body.style || "default");

        const voice =
          String(body.voice || "default");

        const music =
          String(body.music || "default");

        const sound =
          String(body.sound || "default");

        const duration =
          String(body.duration || "default");

        const hasImage =
          Boolean(body.hasImage);

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
            message:
              aiResponse.response ||
              "AI generated the video plan.",
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

    // =========================================================
    // MAGIC HOUR TEXT-TO-VIDEO
    //
    // Protected by VIDEO_TEST_SECRET.
    // The public website cannot call this without the secret.
    //
    // IMPORTANT:
    // This submits ONE Magic Hour generation job and returns
    // the project ID.
    // =========================================================

    if (
      url.pathname === "/magic-hour-generate" &&
      request.method === "POST"
    ) {
      try {
        const providedSecret =
          request.headers.get("X-Video-Test-Secret");

        if (
          !env.VIDEO_TEST_SECRET ||
          providedSecret !== env.VIDEO_TEST_SECRET
        ) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Unauthorized Magic Hour request."
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        if (!env.MAGIC_HOUR_API_KEY) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Magic Hour API key is not configured."
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

        const body = await request.json();

        const prompt =
          String(body.prompt || "").trim();

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

        const magicHourResponse = await fetch(
          "https://api.magichour.ai/v1/text-to-video",
          {
            method: "POST",
            headers: {
              "Authorization":
                `Bearer ${env.MAGIC_HOUR_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              name: "AI Video Studio test",
              end_seconds: 5,
              aspect_ratio: "16:9",
              resolution: "720p",
              model: "kling-3.0",
              audio: true,
              style: {
                prompt
              }
            })
          }
        );

        const result =
          await magicHourResponse.json();

        if (!magicHourResponse.ok) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Magic Hour video request failed.",
              magicHour: result
            }),
            {
              status: magicHourResponse.status,
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
            status: "submitted",
            projectId: result.id,
            magicHour: result
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
            error:
              "Magic Hour request failed.",
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

    // =========================================================
    // MAGIC HOUR PROJECT STATUS
    //
    // This checks an existing project.
    // It does NOT create another video.
    // =========================================================

    if (
      url.pathname === "/magic-hour-status" &&
      request.method === "GET"
    ) {
      try {
        const providedSecret =
          request.headers.get("X-Video-Test-Secret");

        if (
          !env.VIDEO_TEST_SECRET ||
          providedSecret !== env.VIDEO_TEST_SECRET
        ) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Unauthorized Magic Hour status request."
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        if (!env.MAGIC_HOUR_API_KEY) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "Magic Hour API key is not configured."
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

        const projectId =
          url.searchParams.get("projectId");

        if (!projectId) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "projectId is required."
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

        const statusResponse = await fetch(
          `https://api.magichour.ai/v1/video-projects/${encodeURIComponent(projectId)}`,
          {
            method: "GET",
            headers: {
              "Authorization":
                `Bearer ${env.MAGIC_HOUR_API_KEY}`,
              "Accept": "application/json"
            }
          }
        );

        const result =
          await statusResponse.json();

        return new Response(
          JSON.stringify({
            ok: statusResponse.ok,
            project: result
          }),
          {
            status: statusResponse.status,
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
            error:
              "Magic Hour status request failed.",
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

    // =========================================================
    // DEFAULT RESPONSE
    // =========================================================

    return new Response(
      "AI Video Platform backend is online.",
      {
        headers: corsHeaders
      }
    );
  }
};
