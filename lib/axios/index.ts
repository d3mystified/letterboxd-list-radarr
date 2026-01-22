import Axios from "axios";
import { logger } from "../logger";
import { RobotsGuard } from "./robots-guard";
import { userAgentString } from "./user-agent";

const axiosLogger = logger.child({ module: "AxiosInstance" });

const instance = Axios.create({
    headers: {
        "User-Agent": userAgentString,
    },
});

const robotsGuard = new RobotsGuard(instance);

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL;

export default async function get(url: string): Promise<string> {
    // If FlareSolverr is configured, use it and skip robots.txt
    if (FLARESOLVERR_URL) {
        axiosLogger.debug(`Using FlareSolverr proxy for ${url}`);
        const response = await instance.post(FLARESOLVERR_URL, {
            cmd: "request.get",
            url: url,
            maxTimeout: 60000,
        });

        if (response.data?.status === "error") {
            axiosLogger.error(
                `FlareSolverr error for ${url}: ${response.data.message}`
            );
            throw new Error(`FlareSolverr error: ${response.data.message}`);
        }

        if (!response.data?.solution?.response) {
            axiosLogger.error(
                `FlareSolverr returned invalid response for ${url}`
            );
            throw new Error("FlareSolverr returned invalid response");
        }

        return response.data.solution.response;
    }

    // Standard path with robots.txt checking
    if (!robotsGuard.isLoaded) {
        await robotsGuard.load();
    }

    if (!robotsGuard.isAllowed(url)) {
        axiosLogger.error(
            `Tried accessing robots.txt disallowed URL (${url}).`
        );
        throw new Error("Disallowed URL according to robots.txt");
    }

    const response = await instance.get(url);
    return response.data;
}
