"use client";

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '~/components/ui/Modal';
import IconButton from '~/components/ui/IconButton';

interface StatisticsInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function StatisticsInfoModal({ isOpen, onClose }: StatisticsInfoModalProps) {
    const tHall = useTranslations('hall');
    const tCommon = useTranslations('common');
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{tHall('statisticsInfoTitle')}</h3>
                    <IconButton
                        onClick={onClose}
                        variant="subtle"
                        size="sm"
                        aria-label={tCommon('close')}
                    >
                        <X className="w-6 h-6" />
                    </IconButton>
                </div>

                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-point-yellow text-lg">{tHall('winsHeading')}</span>
                        </div>
                        <p className="text-sm text-white font-medium">{tHall('winsTitle')}</p>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            {tHall('winsDesc')}
                        </p>
                    </div>

                    <div className="w-full h-[1px] bg-white/10" />

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-point-yellow text-lg">{tHall('oneVsOneHeading')}</span>
                        </div>
                        <p className="text-sm text-white font-medium">{tHall('oneVsOneTitle')}</p>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            {tHall('oneVsOneDesc')}
                        </p>
                    </div>

                    <div className="w-full h-[1px] bg-white/10" />

                    <p className="text-xs text-gray-400 italic">{tHall('rankingsNote')}</p>
                </div>
            </div>
        </Modal>
    );
}
