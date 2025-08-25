import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "AlanDCE";
const token = process.env.GITHUB_TOKEN;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${path}`);
  }
  return response.json();
}

const profile = await github(`/users/${owner}`);
const repositories = [];
for (let page = 1; ; page += 1) {
  const batch = await github(`/users/${owner}/repos?per_page=100&page=${page}&type=owner`);
  repositories.push(...batch);
  if (batch.length < 100) break;
}

const languages = new Map();
for (const repository of repositories.filter((repo) => !repo.fork)) {
  const data = await github(`/repos/${owner}/${repository.name}/languages`);
  for (const [language, bytes] of Object.entries(data)) {
    languages.set(language, (languages.get(language) || 0) + bytes);
  }
}

const topLanguages = [...languages.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
const totalBytes = topLanguages.reduce((total, [, bytes]) => total + bytes, 0) || 1;
const colors = ["#7c3aed", "#a855f7", "#c084fc", "#e879f9", "#f0abfc", "#f5d0fe"];

const escape = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const card = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="180" viewBox="0 0 495 180">
<rect width="495" height="180" rx="8" fill="#222222"/>
<text x="24" y="38" fill="#f3f4f6" font-family="Arial,sans-serif" font-size="18" font-weight="700">${escape(title)}</text>
${body}
</svg>
`;

const statsBody = `
<text x="24" y="78" fill="#d1d5db" font-family="Arial,sans-serif" font-size="15">Repositorios públicos</text>
<text x="430" y="78" text-anchor="end" fill="#c084fc" font-family="Arial,sans-serif" font-size="19" font-weight="700">${profile.public_repos}</text>
<text x="24" y="112" fill="#d1d5db" font-family="Arial,sans-serif" font-size="15">Seguidores</text>
<text x="430" y="112" text-anchor="end" fill="#c084fc" font-family="Arial,sans-serif" font-size="19" font-weight="700">${profile.followers}</text>
<text x="24" y="146" fill="#d1d5db" font-family="Arial,sans-serif" font-size="15">Personas siguiendo</text>
<text x="430" y="146" text-anchor="end" fill="#c084fc" font-family="Arial,sans-serif" font-size="19" font-weight="700">${profile.following}</text>`;

let offset = 24;
const languageBody = topLanguages
  .map(([language, bytes], index) => {
    const width = (bytes / totalBytes) * 447;
    const segment = `<rect x="${offset}" y="67" width="${width}" height="12" fill="${colors[index]}"/>`;
    offset += width;
    return segment;
  })
  .join("");
const languageLabels = topLanguages
  .map(
    ([language, bytes], index) =>
    `<circle cx="32" cy="${98 + index * 15}" r="5" fill="${colors[index]}"/><text x="46" y="${103 + index * 15}" fill="#d1d5db" font-family="Arial,sans-serif" font-size="13">${escape(language)} ${(bytes / totalBytes * 100).toFixed(1)}%</text>`,
  )
  .join("");

await mkdir("assets", { recursive: true });
await writeFile("assets/github-stats.svg", card("Estadísticas de GitHub", statsBody));
await writeFile(
  "assets/top-languages.svg",
  card("Lenguajes más usados", `<rect x="24" y="67" width="447" height="12" rx="4" fill="#3f3f46"/>${languageBody}${languageLabels}`),
);
