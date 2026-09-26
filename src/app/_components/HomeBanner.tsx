import Carousel from "~/components/ui/Carousel";

// 배너 원본: Luma 이벤트 커버(정사각) → 1280×618 합성. 3번째 슬롯(Data Market)은 디자인 파일 수령 후 추가.
const BANNERS = [
  {
    imageUrl: "/images/banner/1_midnight_hackathon.webp",
    linkUrl: "https://luma.com/2pnv2fwk",
  },
  {
    imageUrl: "/images/banner/2_enter_the_night.webp",
    linkUrl: "https://luma.com/zwb1a9m1?tk=ZOTA0H",
  },
];

export default function HomeBanner() {
  return <Carousel images={BANNERS} />;
}
