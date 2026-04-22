import { Environments, getEnvironment } from './auth-superuser/auth-superuser.type';

export interface TestConfig {
  environment: Environments;
  posUrl: string;
  posServiceUrl: string;
  adminUrl: string;
  adminServiceUrl: string;
  officeUrl: string;
  stocktakingUrl: string;
  inventoryServiceUrl: string;
  recommenderServiceUrl: string;
  iotServiceUrl: string;
  assetServiceUrl: string;
  currencyServiceUrl: string;
}

const CONFIG: Record<Environments, TestConfig> = {
  dev: {
    environment: 'dev',
    posUrl: 'http://localhost:8080',
    posServiceUrl: 'https://sta.pos-service-v1.subsidia.ch',
    adminUrl: 'http://localhost:8091',
    adminServiceUrl: 'https://sta.admin-service-v1.subsidia.ch',
    officeUrl: 'http://localhost:8090',
    stocktakingUrl: 'http://localhost:8092',
    inventoryServiceUrl: 'https://sta.inventory-service-v1.subsidia.ch',
    recommenderServiceUrl: 'https://sta.recommender-service-v1.subsidia.ch',
    iotServiceUrl: 'https://sta.iot-service-v1.subsidia.ch',
    assetServiceUrl: 'https://sta.asset-service-v1.subsidia.ch',
    currencyServiceUrl: 'https://sta.currency-service-v1.subsidia.ch',
  },
  ci: {
    environment: 'ci',
    posUrl: 'http://localhost:8080',
    posServiceUrl: 'https://sta.pos-service-v1.subsidia.ch',
    adminUrl: 'http://localhost:8091',
    adminServiceUrl: 'https://sta.admin-service-v1.subsidia.ch',
    officeUrl: 'http://localhost:8090',
    stocktakingUrl: 'http://localhost:8092',
    inventoryServiceUrl: 'https://sta.inventory-service-v1.subsidia.ch',
    recommenderServiceUrl: 'https://sta.recommender-service-v1.subsidia.ch',
    iotServiceUrl: 'https://sta.iot-service-v1.subsidia.ch',
    assetServiceUrl: 'https://sta.asset-service-v1.subsidia.ch',
    currencyServiceUrl: 'https://sta.currency-service-v1.subsidia.ch',
  },
  pre: {
    environment: 'pre',
    posUrl: 'https://pre.pos.subsidia.ch',
    posServiceUrl: 'https://pre.pos-service-v1.subsidia.ch',
    adminUrl: 'https://pre.admin.subsidia.ch',
    adminServiceUrl: 'https://pre.admin-service-v1.subsidia.ch',
    officeUrl: 'https://pre.office.subsidia.ch',
    stocktakingUrl: 'https://pre.stocktaking.subsidia.ch',
    inventoryServiceUrl: 'https://pre.inventory-service-v1.subsidia.ch',
    recommenderServiceUrl: 'https://pre.recommender-service-v1.subsidia.ch',
    iotServiceUrl: 'https://pre.iot-service-v1.subsidia.ch',
    assetServiceUrl: 'https://pre.asset-service-v1.subsidia.ch',
    currencyServiceUrl: 'https://pre.currency-service-v1.subsidia.ch',
  },
};

export const environment = getEnvironment(process.env.ENVIRONMENT);
export const metadata = CONFIG[environment];
