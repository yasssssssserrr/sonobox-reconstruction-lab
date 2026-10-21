import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',fullyParallel:false,workers:1,timeout:120000,use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:4317/',viewport:{width:1440,height:1000},headless:true,acceptDownloads:true},reporter:'list'});
