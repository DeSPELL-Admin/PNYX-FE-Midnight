import Carousel from "~/components/ui/Carousel";

const BANNERS = [
  {
    imageUrl: "/images/banner/1_pikit_open.webp",
    linkUrl: "https://app.startale.com/miniapps#pikit-pnyx",
  },
  {
    imageUrl: "/images/banner/2_pikit_sbt.webp",
    linkUrl: "https://x.com/PIKITdotFun/status/2062499893613371830?s=20",
  },
  {
    imageUrl: "/images/banner/5_startale.jpg",
    linkUrl: " https://app.startale.com/",
  },
];

export default function HomeBanner() {
  return <Carousel images={BANNERS} />;
}
