import { Skeleton } from "./Skeleton"

export default function CardSkeleton() {
    return (
        <div className="bg-brand-primary-800 border border-brand-primary-700 rounded-xl overflow-hidden relative w-full">
            {/* Image Grid Area */}
            <div className="grid grid-cols-2 w-full h-32">
                <div className="relative w-full h-full border-r border-brand-primary-700">
                    <Skeleton className="w-full h-full rounded-none bg-brand-primary-700/50" />
                </div>
                <div className="relative w-full h-full">
                    <Skeleton className="w-full h-full rounded-none bg-brand-primary-700/50" />
                </div>
            </div>

            {/* Description Overlay Area */}
            <div className="absolute bottom-0 left-0 right-0 p-2">
                <div
                    className="absolute inset-0 backdrop-blur-[15px] bg-[rgba(25,25,25,0.25)]"
                    style={{ maskImage: 'linear-gradient(to top, black 70%, transparent)' }}
                />
                <div className="relative z-10 space-y-2">
                    {/* Title Placeholder */}
                    {/* <Skeleton className="h-4 w-3/4 bg-brand-primary-700/40" /> */}

                    {/* Description Placeholder - 2 lines to match Card's potential height */}
                    <Skeleton className="h-4 w-full bg-brand-primary-600/60" />
                    <Skeleton className="h-4 w-2/3 bg-brand-primary-600/60" />
                </div>
            </div>
        </div>
    )
}
