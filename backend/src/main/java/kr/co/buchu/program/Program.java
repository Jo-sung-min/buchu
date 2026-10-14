package kr.co.buchu.program;

import java.util.List;

public record Program(
        String slug,
        String name,
        String tagline,
        String description,
        String category,
        List<String> channels,
        String cost,
        String costLabel,
        String commission,
        String settlement,
        String difficulty,
        boolean featured,
        String officialUrl,
        String guideUrl,
        String brandColor,
        String initials,
        List<String> tags,
        List<String> highlights,
        List<String> steps,
        List<String> cautions,
        String verifiedAt
) {}
