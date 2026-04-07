import MemberMethods from "./members";
declare const _default: (secretKey: string, test?: boolean) => {
    members: MemberMethods;
    verifySignature: ({ signatureHeader, secret, payload, tolerance }: {
        signatureHeader: string;
        secret: string;
        payload: object;
        tolerance?: number;
    }) => boolean;
    verifyWebhookSignature: ({ headers, secret, payload, tolerance }: {
        headers: object;
        secret: string;
        payload: object;
        tolerance?: number;
    }) => boolean;
    verifyToken: ({ token, audience }: {
        token: string;
        audience?: string;
    }) => Promise<Pick<import("jose").JWTPayload, "iat" | "exp"> & {
        id: string;
        type: "member";
    }>;
};
export default _default;
