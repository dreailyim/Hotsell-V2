
import type { Timestamp } from "firebase/firestore";

export type ShippingMethod = '面交' | '速遞包郵' | '速遞到付';

export type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string; // Legacy, for fallback
  images?: string[]; // New field for multiple images
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
  createdAt: Timestamp | string; 
};

export interface FullUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    createdAt: Timestamp | string; // Stored as ISO string in state, Timestamp from Firestore
    aboutMe?: string;
    totalUnreadCount?: number;
    // New fields for reviews
    averageRating?: number;
    reviewCount?: number;
}

export type Review = {
    id: string;
    ratedUserId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerAvatar: string;
    productId: string;
    productName: string; // Added field
    productImage: string; // Added field
    transactionPrice: number; // Added field
    rating: number;
    comment: string;
    createdAt: Timestamp | string;
}

export type Conversation = {
  id: string;
  participantIds: string[];
  participantDetails: {
    [key: string]: {
      displayName: string;
      photoURL: string;
    }
  };
  product: {
    id: string;
    name: string;
    image: string;
    price?: number;
    status?: 'reserved' | 'sold';
    sellerId: string;
  };
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Timestamp | string; // Correctly handle both Firestore Timestamp and client-side strings
  } | null;
  lastActivity: Timestamp | string;
  unreadCounts: {
    [key:string]: number;
  };
  // New fields for bidding
  bidderId?: string;
  bidPrice?: number;
  bidStatus?: 'pending' | 'accepted' | 'declined' | 'cancelled';
  // New field for reviews
  reviewStatus?: {
    [key: string]: boolean;
  };
  // New field for deletion logic
  hiddenFor?: string[];
};

export type Message = {
    id: string;
    senderId: string;
    text: string;
    timestamp: Timestamp | Date | string; // Stored as an ISO string
};

// This type is deprecated and will be replaced by Conversation
export type Chat = {
  id: string;
  otherUser: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
  };
  lastMessage: string;
  lastMessageDate: string; // Stored as an ISO string for simplicity
  unreadCount: number;
};

export type SystemNotification = {
    id: string;
    userId: string; // The user who receives the notification
    type: 'new_favorite' | 'item_sold_to_other' | 'price_drop' | 'new_listing_success' | 'item_sold' | 'new_review' | 'new_message';
    message: string;
    isRead: boolean;
    createdAt: Timestamp | string;
    relatedData?: {
        conversationId?: string;
        productId?: string;
        productName?: string;
        productImage?: string;
        actorId?: string; // The user who performed the action (e.g., favorited your item)
        actorName?: string;
        price?: number;
    };
};
