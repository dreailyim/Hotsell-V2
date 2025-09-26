
import type { Timestamp } from "firebase-admin/firestore";

export type ShippingMethod = '面交' | '速遞包郵' | '速遞到付';

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  sellerId: string;
  sellerName:string;
  sellerAvatar?: string;
  favorites: number;
  favoritedBy: string[];
  category: string;
  description: string;
  condition: '全新' | '幾乎全新' | '較少使用' | '狀況良好' | '狀況尚可';
  shippingMethods: ShippingMethod[];
  pickupLocation?: string;
  status?: 'reserved' | 'sold';
  createdAt: Timestamp; 
};

export type Review = {
    id: string;
    ratedUserId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerAvatar: string;
    productId: string;
    productName: string;
    productImage: string;
    transactionPrice: number;
    rating: number;
    comment: string;
    createdAt: Timestamp;
    reviewerRole?: 'buyer' | 'seller';
}

    