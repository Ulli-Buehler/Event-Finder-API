export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Ulli-Buehler/Event-Finder/actions/workflows/import.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return res.status(500).json({
        success: false,
        error: text,
      });
    }

    return res.status(200).json({
      success: true,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}