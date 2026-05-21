const OWNER = "Ulli-Buehler";
const REPO = "Event-Finder-API";
const BRANCH = "main";
const FILE_PATH = "Event-Finder-main/prompt.txt";

export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).json({
      error: "Nur POST erlaubt"
    });
  }

  try{

    const token = process.env.GITHUB_TOKEN;

    if(!token){
      throw new Error("GITHUB_TOKEN fehlt");
    }

    const text = String(req.body || "");

    const current = await getCurrentFile(token);

    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({
          message: "Update prompt.txt",
          content: Buffer
            .from(text)
            .toString("base64"),
          sha: current.sha,
          branch: BRANCH
        })
      }
    );

    const result = await response.json();

    if(!response.ok){
      throw new Error(
        result.message || "GitHub Fehler"
      );
    }

    return res.status(200).json({
      ok: true
    });

  }catch(error){

    return res.status(500).json({
      error: error.message
    });
  }
}

async function getCurrentFile(token){

  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const result = await response.json();

  if(!response.ok){
    throw new Error(
      result.message || "prompt.txt nicht gefunden"
    );
  }

  return result;
}