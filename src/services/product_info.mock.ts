import { vi, type Mocked } from "vitest";
import { BehaviorSubject } from "rxjs";
import { ProductInfo } from "./product_info";

export type ProductInfoMock = Mocked<ProductInfo>;

export const createProductInfoMock = (): ProductInfoMock => {
  const productInfoMock: Mocked<Pick<ProductInfo, keyof ProductInfo>> = {
    init: vi.fn(),
    services: [],
    firmware: "test",
    firmware$: new BehaviorSubject<string | undefined>("test"),
  };

  return productInfoMock as ProductInfoMock;
};
