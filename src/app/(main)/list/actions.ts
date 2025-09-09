'use server';

import { generateProductDescription } from '@/ai/flows/generate-product-description';
import type { GenerateProductDescriptionOutput } from '@/ai/flows/generate-product-description';

type GenerateDescriptionActionInput = {
  productName: string;
  productCategory: string;
  productImage: string;
  productDetails: string;
};

type ActionResult = {
  data?: GenerateProductDescriptionOutput;
  error?: string;
};

export async function generateDescriptionAction(
  input: GenerateDescriptionActionInput
): Promise<ActionResult> {
  try {
    const result = await generateProductDescription({
        productName: input.productName,
        productCategory: input.productCategory,
        productImage: input.productImage,
        productDetails: input.productDetails,
    });
    return { data: result };
  } catch (error) {
    console.error('Error generating description:', error);
    // Return a user-friendly error message
    return { error: '無法生成描述，請稍後再試。' };
  }
}
