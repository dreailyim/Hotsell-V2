
'use client';

import { useState, useTransition, useRef } from 'react';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Upload, Wand2, Loader2, X, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateDescriptionAction } from '@/app/(main)/list/actions';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase/client-app';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ShippingMethod } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';

const MAX_IMAGES = 5;

const formSchema = z.object({
  productName: z.string().min(2, { message: '產品名稱至少需要2個字' }),
  productCategory: z.string({ required_error: '請選擇一個產品類別' }),
  price: z.coerce.number().min(0, { message: '價格不能為負數' }),
  condition: z.enum(['new', 'like_new', 'lightly_used', 'good', 'fair'], {
    required_error: '請選擇新舊程度',
  }),
  shippingMethods: z.array(z.string()).refine(value => value.some(item => item), {
    message: "您必須至少選擇一種交收方式。",
  }),
  pickupLocation: z.string().optional(),
  productDescription: z.string().optional(),
}).refine(data => {
    if (data.shippingMethods.includes('面交')) {
      return data.pickupLocation && data.pickupLocation.trim().length > 0;
    }
    return true;
}, {
    message: '請填寫交收地點',
    path: ['pickupLocation'],
});

type FormValues = z.infer<typeof formSchema>;

const ShippingMethodWatcher = ({ control, setValue }: { control: any, setValue: any }) => {
  const { t } = useTranslation();
  const shippingMethods = useWatch({
    control,
    name: 'shippingMethods',
  });

  const mtrLines = {
      island_line: ['kennedy_town', 'hku', 'sai_ying_pun', 'sheung_wan', 'central', 'admiralty', 'wan_chai', 'causeway_bay', 'tin_hau', 'fortress_hill', 'north_point', 'quarry_bay', 'tai_koo', 'sai_wan_ho', 'shau_kei_wan', 'heng_fa_chuen', 'chai_wan'],
      tsuen_wan_line: ['central', 'admiralty', 'tsim_sha_tsui', 'jordan', 'yau_ma_tei', 'mong_kok', 'prince_edward', 'sham_shui_po', 'cheung_sha_wan', 'lai_chi_kok', 'mei_foo', 'lai_king', 'kwai_fong', 'kwai_hing', 'tai_wo_hau', 'tsuen_wan'],
      kwun_tong_line: ['whampoa', 'ho_man_tin', 'yau_ma_tei', 'mong_kok', 'prince_edward', 'shek_kip_mei', 'kowloon_tong', 'lok_fu', 'wong_tai_sin', 'diamond_hill', 'choi_hung', 'kowloon_bay', 'ngau_tau_kok', 'kwun_tong', 'lam_tin', 'yau_tong', 'tiu_keng_leng'],
      south_island_line: ['admiralty', 'ocean_park', 'wong_chuk_hang', 'lei_tung', 'south_horizons'],
      tseung_kwan_o_line: ['north_point', 'quarry_bay', 'yau_tong', 'tiu_keng_leng', 'tseung_kwan_o', 'hang_hau', 'po_lam', 'lohask_park'],
      tung_chung_line: ['hong_kong', 'kowloon', 'olympic', 'nam_cheong', 'lai_king', 'tsing_yi', 'sunny_bay', 'tung_chung'],
      tuen_ma_line: ['wu_kai_sha', 'ma_on_shan', 'heng_on', 'tai_shui_hang', 'shek_mun', 'city_one', 'sha_tin_wai', 'che_kung_temple', 'tai_wai', 'hin_keng', 'diamond_hill', 'kai_tak', 'sung_wong_toi', 'to_kwa_wan', 'ho_man_tin', 'hung_hom', 'east_tsim_sha_tsui', 'austin', 'nam_cheong', 'mei_foo', 'tsuen_wan_west', 'kam_sheung_road', 'yuen_long', 'long_ping', 'tin_shui_wai', 'siu_hong', 'tuen_mun'],
      east_rail_line: ['admiralty', 'exhibition_centre', 'hung_hom', 'mong_kok_east', 'kowloon_tong', 'tai_wai', 'sha_tin', 'fo_tan', 'racecourse', 'university', 'tai_po_market', 'tai_wo', 'fanling', 'sheung_shui', 'lo_wu', 'lok_ma_chau'],
      disneyland_resort_line: ['sunny_bay', 'disneyland_resort'],
      airport_express: ['hong_kong', 'kowloon', 'tsing_yi', 'airport', 'asiaworld_expo'],
  };

  return (
    shippingMethods?.includes('面交') && (
      <FormField
        control={control}
        name="pickupLocation"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('listing_form.location.label')}</FormLabel>
            <div className="flex flex-col sm:flex-row items-center gap-2">
                <Select onValueChange={(value) => field.onChange(value)} defaultValue={field.value}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder={t('listing_form.location.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(mtrLines).map(([lineKey, stations]) => (
                            <SelectGroup key={lineKey}>
                                <SelectLabel>{t(`mtr_lines.${lineKey as keyof typeof mtrLines}`)}</SelectLabel>
                                {stations.map(stationKey => (
                                    <SelectItem key={stationKey} value={t(`mtr_stations.${stationKey}`)}>
                                        {t(`mtr_stations.${stationKey}`)}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
                <FormControl>
                  <Input placeholder={t('listing_form.location.details_placeholder')} {...field} />
                </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  );
};


export function ListingForm() {
  const { t } = useTranslation();
  const [isAiPending, startAiTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagesData, setImagesData] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const shippingMethodOptions: { id: ShippingMethod; label: string }[] = [
    { id: '面交', label: t('listing_form.shipping.meetup') },
    { id: '速遞包郵', label: t('listing_form.shipping.delivery_included') },
    { id: '速遞到付', label: t('listing_form.shipping.delivery_cod') },
  ];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      productCategory: undefined,
      price: 0,
      condition: undefined,
      shippingMethods: [],
      pickupLocation: '',
      productDescription: '',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (imagesData.length >= MAX_IMAGES) {
        toast({
          title: '圖片數量已達上限',
          description: `您最多只能上傳 ${MAX_IMAGES} 張圖片。`,
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        toast({
          title: '圖片太大',
          description: '請上傳小於 4MB 的圖片。',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagesData(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveImage = (index: number) => {
    setImagesData(prev => prev.filter((_, i) => i !== index));
  }

  const handleGenerateDescription = () => {
    const values = form.getValues();
    const firstImage = imagesData[0];
    if (!firstImage) {
      toast({
        title: '請先上傳圖片',
        description: 'AI 需要圖片來生成描述。',
        variant: 'destructive',
      });
      return;
    }
    if (!values.productName || !values.productCategory) {
      toast({
        title: '缺少產品資訊',
        description: '請填寫產品名稱和類別。',
        variant: 'destructive',
      });
      return;
    }

    startAiTransition(async () => {
      const result = await generateDescriptionAction({
        productName: values.productName,
        productCategory: values.productCategory,
        productImage: firstImage,
        productDetails: '',
      });

      if (result.error) {
        toast({
          title: '生成失敗',
          description: result.error,
          variant: 'destructive',
        });
      } else if (result.data) {
        form.setValue('productDescription', result.data.productDescription);
        toast({
          title: '描述已生成！',
          description: 'AI 寫的描述已填入欄位。',
        });
      }
    });
  };

  async function onSubmit(values: FormValues) {
    if (!user) {
        toast({ title: '您必須登入才能刊登商品。', variant: 'destructive' });
        return;
    }
    if (imagesData.length === 0) {
        toast({ title: '請至少上傳一張圖片。', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);

    try {
        const imageUrls = await Promise.all(
          imagesData.map(async (imageData) => {
            const imageRef = ref(storage, `products/${user.uid}/${uuidv4()}`);
            await uploadString(imageRef, imageData, 'data_url');
            return getDownloadURL(imageRef);
          })
        );


        const newDocRef = await addDoc(collection(db, 'products'), {
            name: values.productName,
            name_lowercase: values.productName.toLowerCase(),
            category: values.productCategory,
            price: values.price,
            originalPrice: values.price,
            condition: values.condition,
            shippingMethods: values.shippingMethods,
            pickupLocation: values.shippingMethods.includes('面交') ? values.pickupLocation : '',
            description: values.productDescription,
            images: imageUrls,
            image: imageUrls[0], // For legacy compatibility
            sellerId: user.uid,
            sellerName: user.displayName,
            sellerAvatar: user.photoURL,
            createdAt: serverTimestamp(),
            favorites: 0,
            favoritedBy: [],
        });

        toast({
            title: t('listing_form.create_success'),
        });
        
        router.push(`/products/${newDocRef.id}`);

    } catch (error: any) {
        console.error("Error creating listing:", error);
        toast({
            title: t('listing_form.create_fail'),
            description: error.message || '發生未知錯誤，請稍後再試。',
            variant: 'destructive'
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-2">
          <FormLabel>{t('listing_form.images.label')}</FormLabel>
          <FormDescription>{t('listing_form.images.description').replace('{max_images}', String(MAX_IMAGES))}</FormDescription>
           <div className="grid grid-cols-3 gap-2">
                {imagesData.map((image, index) => (
                    <div key={index} className="relative aspect-square w-full">
                        <div className="w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center relative bg-muted/50">
                            <Image
                                src={image}
                                alt={`Product preview ${index + 1}`}
                                fill
                                className="object-contain rounded-lg p-1"
                            />
                            <Button 
                                type="button" 
                                variant="destructive" 
                                size="icon" 
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => handleRemoveImage(index)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {imagesData.length < MAX_IMAGES && (
                     <div className="relative aspect-square w-full">
                        <div className="w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center relative bg-muted/50">
                            <div className="text-center text-muted-foreground p-2">
                                <Plus className="mx-auto h-8 w-8" />
                                <p className="text-[10px] leading-tight mt-1">{imagesData.length === 0 ? t('listing_form.images.add_cover') : t('listing_form.images.add')}</p>
                            </div>
                            <Input
                                type="file"
                                ref={fileInputRef}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/png, image/jpeg, image/gif"
                                onChange={handleFileChange}
                                required={imagesData.length === 0}
                            />
                        </div>
                    </div>
                )}
           </div>
           <FormMessage />
        </div>

        <FormField
          control={form.control}
          name="productName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('listing_form.name.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('listing_form.name.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="productCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('listing_form.category.label')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('listing_form.category.placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                   <SelectItem value="women_fashion">{t('category.women_fashion')}</SelectItem>
                  <SelectItem value="men_fashion">{t('category.men_fashion')}</SelectItem>
                  <SelectItem value="beauty_health">{t('category.beauty_health')}</SelectItem>
                  <SelectItem value="handbags_accessories">{t('category.handbags_accessories')}</SelectItem>
                  <SelectItem value="electronics">{t('category.electronics')}</SelectItem>
                  <SelectItem value="games">{t('category.games')}</SelectItem>
                  <SelectItem value="home_living">{t('category.home_living')}</SelectItem>
                  <SelectItem value="pet_supplies">{t('category.pet_supplies')}</SelectItem>
                  <SelectItem value="hobbies_collectibles">{t('category.hobbies_collectibles')}</SelectItem>
                  <SelectItem value="books_stationery">{t('category.books_stationery')}</SelectItem>
                  <SelectItem value="baby_kids">{t('category.baby_kids')}</SelectItem>
                  <SelectItem value="other">{t('category.other')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('listing_form.price.label')}</FormLabel>
              <FormControl>
                <Input type="number" placeholder={t('listing_form.price.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="condition"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('listing_form.condition.label')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('listing_form.condition.placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="new">{t('condition.new')}</SelectItem>
                  <SelectItem value="like_new">{t('condition.like_new')}</SelectItem>
                  <SelectItem value="lightly_used">{t('condition.lightly_used')}</SelectItem>
                  <SelectItem value="good">{t('condition.good')}</SelectItem>
                  <SelectItem value="fair">{t('condition.fair')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shippingMethods"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">{t('listing_form.shipping.label')}</FormLabel>
              </div>
              {shippingMethodOptions.map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name="shippingMethods"
                  render={({ field }) => {
                    return (
                      <FormItem
                        key={item.id}
                        className="flex flex-row items-start space-x-3 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), item.id])
                                : field.onChange(
                                    (field.value || [])?.filter(
                                      (value) => value !== item.id
                                    )
                                  )
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {item.label}
                        </FormLabel>
                      </FormItem>
                    )
                  }}
                />
              ))}
              <FormMessage />
            </FormItem>
          )}
        />
        
        <ShippingMethodWatcher control={form.control} setValue={form.setValue} />
        
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>{t('listing_form.description.label')}</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {t('listing_form.ai_button')}
            </Button>
          </div>
          <FormField
            control={form.control}
            name="productDescription"
            render={({ field }) => (
             <>
              <FormControl>
                <Textarea
                  placeholder={t('listing_form.description.placeholder')}
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
               <FormMessage />
              </>
            )}
          />
        </FormItem>

        <Button type="submit" size="lg" className="w-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-primary-foreground dark:text-black hover:opacity-90 transition-opacity" disabled={isSubmitting}>
           {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('listing_form.submit_button.create')}
        </Button>
      </form>
    </Form>
  );
}
