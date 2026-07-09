using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConnectOEE.Infrastructure.Configurations;

public class LineProductRateConfig : IEntityTypeConfiguration<LineProductRate>
{
    public void Configure(EntityTypeBuilder<LineProductRate> builder)
    {
        builder.HasIndex(r => new { r.LineId, r.ProductRecipeId }).IsUnique();
        builder.HasOne(r => r.Line).WithMany().HasForeignKey(r => r.LineId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(r => r.ProductRecipe).WithMany().HasForeignKey(r => r.ProductRecipeId).OnDelete(DeleteBehavior.Cascade);
    }
}
