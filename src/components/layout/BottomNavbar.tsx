"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import Home from '~/assets/icons/home.svg'
import Add from '~/assets/icons/add.svg'
import Hall from '~/assets/icons/hall.svg'
import Mypage from '~/assets/icons/mypage.svg'
import Tournament from '~/assets/icons/tournament.svg'
import { ShoppingBag } from 'lucide-react'
// Navbar를 숨길 경로
const HIDDEN_PATHS = ['/login', '/onboarding'];

import { useTournament } from '~/context/TournamentContext';

export default function BottomNavbar() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const { gameStatus, activeTournamentId } = useTournament();

  // login, onboarding 페이지에서는 숨기기
  const shouldHide = HIDDEN_PATHS.some(path => pathname?.startsWith(path));

  if (shouldHide) {
    return null;
  }

  const navItems = [
    { href: '/', icon: Home, label: tNav('home') },
    { href: '/add', icon: Add, label: tNav('add') },
    { href: '/tournament', icon: Tournament, label: tNav('tournament'), id: 'tournament' as const },
    { href: '/hall', icon: Hall, label: tNav('hall') },
    { href: '/market', icon: ShoppingBag, label: tNav('market') },
    { href: '/mypage', icon: Mypage, label: tNav('mypage') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[430px] bg-[#19191960] backdrop-blur-lg pb-8">
      <div className="flex justify-between items-center py-2">
        {navItems.map((item) => {
          // Simple active check: exact match or starts with (for nested routes like /worldcup/123)
          // Exception for Home '/' which should be exact only
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.id === 'tournament' && activeTournamentId ? `/tournament/${activeTournamentId}` : item.href}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${isActive ? 'text-white' : 'text-white hover:text-white'}`}
            >
              <item.icon className={`w-6 h-6 ${isActive ? 'fill-current' : 'fill-white-400'}`} strokeWidth={isActive ? 2.5 : 2} />
            </Link>
          )
        })}
      </div>
    </nav>
  );
}
