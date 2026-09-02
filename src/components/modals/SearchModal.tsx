"use client";

import { useEffect, useState, useRef } from 'react';
import Modal from '~/components/ui/Modal';
import { Search, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDebounce } from '~/hooks/useDebounce';
import { useCategories, useCategoryTournaments } from '~/hooks/categories';
import { useChainId } from '~/hooks/wallet';
import Card from '~/components/ui/Card';
import CardSkeleton from '~/components/ui/CardSkeleton';
import TournamentSelectedModal from '~/components/modals/TournamentSelectedModal';
import { Tournament } from '~/lib/api/types';
import IconButton from '~/components/ui/IconButton';


// Mock Search Results - Keep for general search as we lack a search API
const MOCK_RESULTS = [
  {
    id: '1',
    title: 'Best Anime Character 2024',
    description: 'Vote for your favorite characters from the top anime of 2024!',
    imageUrl1: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500&auto=format&fit=crop',
    imageUrl2: 'https://images.unsplash.com/photo-1541562232579-512a21360020?q=80&w=500&auto=format&fit=crop',
    category: 'Anime'
  },
  {
    id: '2',
    title: 'Cutest Dog Breed',
    description: 'Which dog breed makes your heart melt the most?',
    imageUrl1: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=500&auto=format&fit=crop',
    imageUrl2: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=500&auto=format&fit=crop',
    category: 'Animal'
  },
  {
    id: '3',
    title: 'Best RPG of All Time',
    description: 'Choose the greatest Role-Playing Game ever made.',
    imageUrl1: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=500&auto=format&fit=crop',
    imageUrl2: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=500&auto=format&fit=crop',
    category: 'Game'
  },
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const tSearch = useTranslations('search');
  const tCommon = useTranslations('common');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTournamentItem, setSelectedTournamentItem] = useState<Tournament | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof MOCK_RESULTS>([]);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const chainId = useChainId();

  // Data Fetching
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const { data: categoryTournaments, isLoading: isCategoryTournamentsLoading } = useCategoryTournaments(
    chainId,
    selectedCategory ?? undefined,
    { enabled: !!selectedCategory }
  );

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedCategory(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      setIsSearching(true);
      // Simulate API call delay for search
      const timer = setTimeout(() => {
        const filtered = MOCK_RESULTS.filter(r =>
          r.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          r.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
        setSearchResults(filtered);
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearchTerm]);

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="fullscreen">
      <div className="flex flex-col h-full bg-primary">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 ">
          <IconButton
            onClick={handleBack}
            className="-ml-2"
            aria-label={tCommon('back')}
          >
            <ArrowLeft size={24} />
          </IconButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          <div className="flex flex-col gap-4">

            {/* Case 1: Search Loading */}
            {isSearching && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Case 2: Search Results (Takes priority) */}
            {!isSearching && searchTerm && (
              <div className="flex flex-col gap-4">
                {searchResults.length > 0 ? (
                  searchResults.map(item => (
                    <Card
                      key={item.id}
                      title={item.title}
                      imageName1=""
                      imageName2=""
                      imageUrl1={item.imageUrl1}
                      imageUrl2={item.imageUrl2}
                      onClick={() => {
                        // For mock results, we can either navigate directly or also use the modal if we convert it.
                        // Let's stick to direct nav for mock results for now as user asked 'L1-L242' which covers everything, 
                        // but `TournamentSelectedModal` expects a `Tournament` type.
                        // MOCK_RESULTS items are not fully compatible. 
                        // However, let's try to cast it if the ID is numeric, but here IDs are '1', '2'.
                        // Let's keep direct nav for Search Results to avoid breakage, or specific mock handling.
                        // User's specific request "immediately router move -> modal" likely targets the main browsing flow.
                        router.push(`/worldcup?q=${item.id}`);
                        onClose();
                      }}
                      className="w-full"
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-lg font-medium text-white mb-1">{tSearch('noResults')}</p>
                    <p className="text-gray-500 text-sm">
                      {tSearch('noResultsFor', { term: searchTerm })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isSearching && !searchTerm && (
              <>
                {/* Case 3: Initial State - Vertical Category List */}
                {!selectedCategory && (
                  <div className="flex flex-col gap-2 pt-2">
                    {isCategoriesLoading ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    ) : (
                      categories &&
                      categories.data?.map((cat) => (
                        <button
                          key={cat.category}
                          onClick={() => setSelectedCategory(cat.category)}
                          className="text-left px-4 py-3 bg-brand-primary-800/50 rounded-xl text-lg font-medium text-white hover:bg-brand-primary-800 transition-colors flex justify-between items-center group"
                        >
                          {cat.category}
                          <span className="text-brand-primary-400 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Case 4: Category Selected - Dropdown + Results */}
                {selectedCategory && (
                  <div className="flex flex-col gap-4">
                    {/* Full width Category Dropdown - Show selected category name */}
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="w-full bg-brand-primary-800 text-white h-12 text-lg px-3 rounded-md flex items-center justify-start font-normal"
                    >
                      {selectedCategory}
                    </button>

                    {/* Results List */}
                    {isCategoryTournamentsLoading ? (
                      <div className="flex flex-col gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <CardSkeleton key={i} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {categoryTournaments && categoryTournaments.data?.length > 0 ? (
                          categoryTournaments.data?.map((item, index) => (
                            <Card
                              key={`${item.tournamentId}-${index}`}
                              title={item.title || tCommon('untitled')}
                              // The Tournament type had title, firstItemImageName, etc.
                              imageName1={item.firstItemImageName}
                              imageName2={item.secondItemImageName}
                              onClick={() => {
                                setSelectedTournamentItem(item);
                                // router.push(`/tournament/${item.tournamentId}`);
                                // onClose();
                              }}
                              className="w-full"
                            />
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                            <p className="text-lg font-medium text-white mb-1">{tSearch('noTournaments')}</p>
                            <p className="text-gray-400 text-sm">
                              {tSearch('noTournamentsInCategory')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
      <TournamentSelectedModal
        isOpen={!!selectedTournamentItem}
        onClose={() => setSelectedTournamentItem(null)}
        tournament={selectedTournamentItem}
        onStart={onClose}
      />
    </Modal>
  );
}
