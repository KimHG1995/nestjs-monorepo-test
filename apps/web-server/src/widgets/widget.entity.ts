/** 위젯 색상 도메인 값입니다. */
export type WidgetColor = 'red' | 'green' | 'blue';

/**
 * web-server 가 관리하는 예시 리소스인 위젯(Widget)입니다.
 * (실제 저장소 대신 인메모리 저장소를 사용하는 목업 도메인입니다.)
 */
export interface Widget {
  id: string;
  name: string;
  color: WidgetColor;
  quantity: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
