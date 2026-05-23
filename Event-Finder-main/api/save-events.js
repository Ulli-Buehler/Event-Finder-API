const OWNER =
  process.env.GITHUB_OWNER ||
  "Ulli-Buehler";

const REPO =
  process.env.GITHUB_REPO ||
  "KI-Eventfinder";

const BRANCH =
  process.env.GITHUB_BRANCH ||
  "main";

const FILE_PATH =
  process.env.EVENTS_FILE_PATH ||
  "Event-Finder-main/events.json";

export default async function handler(req, res){

  if(req.method !== "POST"){

    return res.status(405).json({
      error: "Nur POST erlaubt"
    });
  }

  try{

    const token =
      process.env.GITHUB_TOKEN;

    if(!token){

      throw new Error(
        "GITHUB_TOKEN fehlt"
      );
    }

    const events =
      Array.isArray(req.body)
      ? req.body
      : req.body?.events;

    if(!Array.isArray(events)){

      throw new Error(
        "Ungültige JSON-Datei"
      );
    }

    const content =
      JSON.stringify(
        events,
        null,
        2
      ) + "\n";

    const current =
      await getCurrentFile(token);

    const response =
      await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify({
            message: "Update events.json",
            content: Buffer
              .from(content, "utf8")
              .toString("base64"),
            sha: current.sha,
            branch: BRANCH
          })
        }
      );

    const result =
      await response.json();

    if(!response.ok){

      throw new Error(
        result.message ||
        "GitHub Fehler"
      );
    }

    return res.status(200).json({
      ok: true,
      count: events.length,
      commit: result.commit?.sha || null
    });

  }catch(error){

    return res.status(500).json({
      error: error.message
    });
  }
}

async function getCurrentFile(token){

  const response =
    await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

  const result =
    await response.json();

  if(!response.ok){

    throw new Error(
      result.message ||
      "events.json nicht gefunden"
    );
  }

  return result;
}
