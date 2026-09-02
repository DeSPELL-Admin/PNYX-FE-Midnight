const devManifest = {
  // accountAssociation: {
  //   header: "eyJmaWQiOjMxMTMwMDAsInR5cGUiOiJhdXRoIiwia2V5IjoiMHgxMTM4M0UyODRhYTVGNkFFRWZBZTk5Y0MwOTIxZjgwZDVGZUJCNmU1In0",
  //   payload: "eyJkb21haW4iOiJiZXRhLnByZXNzYXRvc3RhcnQueHl6In0",
  //   signature: "YvJ8w6a0HjWipNrYZDjHoWq6clUw9RB6V+/1eo+d77ZX6HH+BWpQwYGDyl9xw8Rwj2I4AnwQnqvJzAhBonRnEhs="
  // },
  frame: {
    version: "1",
    name: "PNYX Beta",
    tagline: "Crown faves, call shots.",
    iconUrl: "https://beta.pnyx.fun/icon.webp",
    homeUrl: "https://beta.pnyx.fun",
    splashImageUrl: "https://beta.pnyx.fun/splashImage.webp",
    splashBackgroundColor: "#273825",
    heroImageUrl: "https://beta.pnyx.fun/heroImage.webp",
    primaryCategory: "entertainment",
    tags:  ["this-or-that", "preference", "voting", "social", "ranking"],
    webhookUrl: "https://beta.pnyx.fun/api/v1/miniapp-notifications/webhook",
  },
  startale: {
    manifestVersion: "2.3",
    screenCompatibility: {
      desktop: true,
      landscapeOnly: false,
    },
    featuredBannerImageUrl: "https://beta.pnyx.fun/featuredBannerImage.webp",
    projectWebsite: "https://beta.pnyx.fun",
    socialLinks: {
      twitter: "https://x.com/pnyxforall",
      website: "https://beta.pnyx.fun",
      telegram:"https://t.me/DespellSupportbot"
    },
  }
};

const prodManifest = {
  // accountAssociation: {
  //   header: "eyJmaWQiOjMxMTMwMDAsInR5cGUiOiJhdXRoIiwia2V5IjoiMHgxMTM4M0UyODRhYTVGNkFFRWZBZTk5Y0MwOTIxZjgwZDVGZUJCNmU1In0",
  //   payload: "eyJkb21haW4iOiJwcmVzc2F0b3N0YXJ0Lnh5eiJ9",
  //   signature: "Vkc5/7Y1+mEdlxj3sO6cgtNlRsIoWoQ38Os6jW9hoB9xpglVvAkoy/AKwdc07ljDy7IKJY58g4dMvImq/ZnSIhs="
  // },
  frame: {
    version:"1",
    name: "PNYX",
    tagline: "Crown faves, call shots.",
    iconUrl: "https://pnyx.fun/icon.webp",
    homeUrl: "https://pnyx.fun",
    splashImageUrl: "https://pnyx.fun/splashImage.webp",
    splashBackgroundColor: "#273825",
    heroImageUrl: "https://pnyx.fun/heroImage.webp",
    primaryCategory: "entertainment",
    tags: ["this-or-that", "preference", "voting", "social", "ranking"],
    webhookUrl: "https://pnyx.fun/api/v1/miniapp-notifications/webhook",
  },
  startale: {
    manifestVersion: "2.3",
    screenCompatibility: {
      desktop: false,
      landscapeOnly: false,
    },
    featuredBannerImageUrl: "https://pnyx.fun/featuredBannerImage.webp",
    projectWebsite: "https://pnyx.fun",
    socialLinks: {
      twitter: "https://x.com/pnyxforall",
      website: "https://pnyx.fun",
      telegram:"https://t.me/DespellSupportbot"
    },
  }
};

export async function GET() {
  const manifest =
    process.env.NEXT_PUBLIC_DEPLOY_MODE === "production" ? prodManifest : devManifest;

  return Response.json(manifest);
}
