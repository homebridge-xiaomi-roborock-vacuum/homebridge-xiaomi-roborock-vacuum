import { ProductInfo } from "./product_info";

export type ProductInfoMock = jest.Mocked<ProductInfo>;

export const createProductInfoMock = (): ProductInfoMock => {
  const productInfoMock: jest.Mocked<Pick<ProductInfo, keyof ProductInfo>> = {
    init: jest.fn(),
    services: [],
    firmware: "test",
  };

  return productInfoMock as ProductInfoMock;
};
