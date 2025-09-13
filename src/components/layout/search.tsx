'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client-app';
import type { Product } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@/components/ui/popover';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import Image from 'next/image';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

export function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSearch = async () => {
      if (searchTerm.trim() === '') {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          where('name', '>=', searchTerm),
          where('name', '<=', searchTerm + '\uf8ff'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setResults(productsData);
        setOpen(true);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(() => {
      handleSearch();
    }, 300); // 300ms delay

    return () => clearTimeout(debounceTimeout);
  }, [searchTerm]);
  
  const handleSelect = (productId: string) => {
    setOpen(false);
    router.push(`/products/${productId}`);
  };

  return (
    <div className="relative w-full max-w-md">
       <Popover open={open} onOpenChange={setOpen}>
         <PopoverAnchor asChild>
            <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder="搜尋商品..."
                    className="w-full rounded-full pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                 {loading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
        </PopoverAnchor>
        <PopoverContent 
            className="w-[--radix-popover-trigger-width] p-0" 
            onOpenAutoFocus={(e) => e.preventDefault()}
        >
            <Command>
                 <CommandList>
                    {results.length > 0 ? (
                        <CommandGroup>
                            {results.map((product) => (
                                <CommandItem key={product.id} onSelect={() => handleSelect(product.id)} className="cursor-pointer">
                                     <div className="flex items-center gap-3 w-full">
                                        <div className="relative h-10 w-10 flex-shrink-0">
                                            <Image 
                                                src={product.images?.[0] || product.image} 
                                                alt={product.name} 
                                                fill 
                                                className="object-cover rounded-md"
                                                sizes="40px"
                                            />
                                        </div>
                                        <div className="flex-1 truncate">
                                            <p className="truncate text-sm font-medium">{product.name}</p>
                                            <p className="text-xs text-primary">${product.price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : (
                        !loading && searchTerm && <CommandEmpty>找不到「{searchTerm}」的結果。</CommandEmpty>
                    )}
                 </CommandList>
            </Command>
        </PopoverContent>
       </Popover>
    </div>
  );
}
