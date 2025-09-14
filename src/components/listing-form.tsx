
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

const MAX_IMAGES = 5;

const shippingMethodOptions: { id: ShippingMethod; label: string }[] = [
  { id: '面交', label: '面交' },
  { id: '速遞包郵', label: '速遞包郵' },
  { id: '速遞到付', label: '速遞到付' },
];

const formSchema = z.object({
  productName: z.string().min(2, { message: '產品名稱至少需要2個字' }),
  productCategory: z.string({ required_error: '請選擇一個產品類別' }),
  price: z.coerce.number().min(0, { message: '價格不能為負數' }),
  condition: z.enum(['全新', '幾乎全新', '較少使用', '狀況良好', '狀況尚可'], {
    required_error: '請選擇新舊程度',
  }),
  shippingMethods: z.array(z.string()).refine(value => value.some(item => item), {
    message: "您必須至少選擇一種交收方式。",
  }),
  pickupLocation: z.string().optional(),
  productDescription: z.string().min(10, { message: '產品描述至少需要10個字' }),
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

const ShippingMethodWatcher = ({ control }: { control: any }) => {
  const shippingMethods = useWatch({
    control,
    name: 'shippingMethods',
  });

  return (
    shippingMethods?.includes('面交') && (
      <FormField
        control={control}
        name="pickupLocation"
        render={({ field }) => (
          <FormItem>
            <FormLabel>交收地點</FormLabel>
            <FormControl>
              <Input placeholder="例如：旺角地鐵站" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  );
};


export function ListingForm() {
  const [isAiPending, startAiTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagesData, setImagesData] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

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
            title: '刊登成功！',
            description: '您的產品已成功刊登。',
        });
        
        router.push(`/products/${newDocRef.id}`);

    } catch (error: any) {
        console.error("Error creating listing:", error);
        toast({
            title: '刊登失敗',
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
          <FormLabel>產品圖片 (第一張為封面)</FormLabel>
          <FormDescription>最多上傳 ${MAX_IMAGES} 張圖片。每張圖片不能超過 4MB。</FormDescription>
           <div className="grid grid-cols-3 gap-2">
                {imagesData.map((image, index) => (
                    <div key={index} className="relative aspect-square w-full">
                        <div className="w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center relative bg-muted/50">
                            <Image
                                src={image}
                                alt={`Product preview ${index + 1}`}
                                fill
                                className="object-contain rounded-lg p-1"
                                unoptimized
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
                                <p className="text-[10px] leading-tight mt-1">{imagesData.length === 0 ? '點擊上傳封面' : '新增圖片'}</p>
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
              <FormLabel>產品名稱</FormLabel>
              <FormControl>
                <Input placeholder="例如：復古皮質沙發" {...field} />
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
              <FormLabel>產品類別</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇一個類別" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="女裝">女裝</SelectItem>
                  <SelectItem value="男裝">男裝</SelectItem>
                  <SelectItem value="美妝保健">美妝保健</SelectItem>
                  <SelectItem value="手袋及配飾">手袋及配飾</SelectItem>
                  <SelectItem value="電子產品">電子產品</SelectItem>
                  <SelectItem value="遊戲">遊戲</SelectItem>
                  <SelectItem value="家居生活">家居生活</SelectItem>
                  <SelectItem value="寵物用品">寵物用品</SelectItem>
                  <SelectItem value="愛好及收藏品">愛好及收藏品</SelectItem>
                  <SelectItem value="書籍及文具">書籍及文具</SelectItem>
                  <SelectItem value="嬰兒及兒童用品">嬰兒及兒童用品</SelectItem>
                  <SelectItem value="其他">其他</SelectItem>
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
              <FormLabel>價格</FormLabel>
              <FormControl>
                <Input type="number" placeholder="例如：1500" {...field} />
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
              <FormLabel>新舊程度</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇新舊程度" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="全新">全新</SelectItem>
                  <SelectItem value="幾乎全新">幾乎全新</SelectItem>
                  <SelectItem value="較少使用">較少使用</SelectItem>
                  <SelectItem value="狀況良好">狀況良好</SelectItem>
                  <SelectItem value="狀況尚可">狀況尚可</SelectItem>
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
                <FormLabel className="text-base">交收方式</FormLabel>
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
        
        <ShippingMethodWatcher control={form.control} />
        
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>產品描述</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
            >
              <Wand2 className="mr-2 h-4 w-4" />
              AI 生成描述 (稍後推出)
            </Button>
          </div>
          <FormField
            control={form.control}
            name="productDescription"
            render={({ field }) => (
             <>
              <FormControl>
                <Textarea
                  placeholder="描述您的產品..."
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
          刊登物品
        </Button>
      </form>
    </Form>
  );
}

    