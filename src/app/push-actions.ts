"use server";

import { isMyDeviceSubscribed, releaseMyDevice, sendMyTestPush, subscribeMyDevice, unsubscribeMyDevice } from "@/server/dal/push";

// Уведомления на телефон: профиль (включить, выключить, проверочное) и кнопка «Выйти» (отвязать устройство).
export async function pushStatusAction(owner: string, endpoint: string) {
  return isMyDeviceSubscribed(owner, endpoint);
}
export async function pushSubscribeAction(owner: string, subscription: unknown) {
  return subscribeMyDevice(owner, subscription);
}
export async function pushUnsubscribeAction(owner: string, endpoint: string) {
  return unsubscribeMyDevice(owner, endpoint);
}
export async function pushTestAction(owner: string, endpoint: string) {
  return sendMyTestPush(owner, endpoint);
}
export async function pushReleaseAction(endpoint: string) {
  return releaseMyDevice(endpoint);
}
