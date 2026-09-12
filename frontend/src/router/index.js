import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'accueil', component: HomeView },
    { path: '/article/:id', name: 'article', component: () => import('@/views/ArticleView.vue') },
    {
      path: '/publication/:id',
      name: 'publication',
      component: () => import('@/views/PostView.vue')
    },
    { path: '/a-propos', name: 'a-propos', component: () => import('@/views/AboutView.vue') },
    { path: '/redaction', name: 'redaction', component: () => import('@/views/AdminView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
})

export default router
